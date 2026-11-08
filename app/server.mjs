#!/usr/bin/env node
// UsagePass server: static app, JSON API, PayPal return/cancel, verified webhooks, live license stream.
// No dependencies. Node 20+.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { APP_DIR, env, paypal, verifyWebhook, PayPalError } from './lib/paypal.mjs';
import { db, save, newId } from './lib/store.mjs';
import { readRequest } from './lib/ai.mjs';
import { priceRequest } from './lib/ratecard.mjs';
import { checkout, captureOnReturn, cancelled, applyEvent, subscribe, view } from './lib/licenses.mjs';

const PORT = Number(env('PORT', '5175'));
const PUBLIC = join(APP_DIR, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json' };

// ---------- helpers ----------

const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
const redirect = (res, to) => { res.writeHead(302, { Location: to }); res.end(); };
const origin = (req) => env('PUBLIC_URL') || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`;

async function body(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) throw Object.assign(new Error('Request body too large'), { status: 413 }); chunks.push(c); }
  return Buffer.concat(chunks).toString('utf8');
}
async function jsonBody(req) {
  try { return JSON.parse((await body(req)) || '{}'); } catch { throw Object.assign(new Error('Body must be JSON'), { status: 400 }); }
}

// The browser and agents never see collaborator emails or env var names.
const publicWork = (w) => ({ ...w, creators: w.creators.map(({ emailEnv, ...c }) => c) });

// Keeps the free AI quota from being drained by one visitor.
const hits = new Map();
function rateLimited(req, max = 20) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  return list.length > max;
}

// ---------- routes ----------

async function route(req, res, url) {
  const p = url.pathname;
  const m = (rx) => p.match(rx);
  let r;

  if (req.method === 'GET' && p === '/api/health') {
    return json(res, 200, {
      ai: env('GEMINI_API_KEY') ? { provider: 'gemini', model: env('GEMINI_MODEL', 'gemini-2.5-flash') } : { provider: 'offline' },
      paypal: Boolean(env('PAYPAL_CLIENT_ID')), webhook: Boolean(env('PAYPAL_WEBHOOK_ID')), environment: 'sandbox',
    });
  }

  if (req.method === 'GET' && p === '/api/works') return json(res, 200, Object.values(db.works).map(publicWork));
  if (req.method === 'GET' && (r = m(/^\/api\/works\/([\w-]+)$/))) {
    const w = db.works[r[1]];
    return w ? json(res, 200, publicWork(w)) : json(res, 404, { error: 'No such work.' });
  }

  // A brand's sentence → interpretation (AI) → priced quote (rate card).
  if (req.method === 'POST' && (r = m(/^\/api\/works\/([\w-]+)\/quotes$/))) {
    const work = db.works[r[1]];
    if (!work) return json(res, 404, { error: 'No such work.' });
    const { request, brand } = await jsonBody(req);
    const text = String(request || '').trim();
    if (text.length < 8) return json(res, 400, { error: 'Describe how you want to use the work in a sentence or two.' });
    if (text.length > 1200) return json(res, 400, { error: 'Keep the request under 1,200 characters.' });
    if (rateLimited(req)) return json(res, 429, { error: 'Too many requests in a minute. Try again shortly.' });
    const reading = await readRequest(work, text);
    const priced = priceRequest(work, reading.interpretation);
    const quote = {
      id: newId('Q'), workId: work.id, brand: String(brand || 'A brand').trim().slice(0, 80) || 'A brand', request: text,
      ai: { source: reading.source, model: reading.model || null, reason: reading.reason || null, ms: reading.ms, summary: reading.interpretation.summary },
      interpretation: reading.interpretation, ...priced, licenseId: null, createdAt: new Date().toISOString(),
    };
    db.quotes[quote.id] = quote;
    save();
    return json(res, 201, quote);
  }

  if (req.method === 'GET' && p === '/api/quotes') return json(res, 200, Object.values(db.quotes).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  if (req.method === 'GET' && (r = m(/^\/api\/quotes\/([\w-]+)$/))) {
    const q = db.quotes[r[1]];
    return q ? json(res, 200, q) : json(res, 404, { error: 'No such quote.' });
  }

  if (req.method === 'POST' && (r = m(/^\/api\/quotes\/([\w-]+)\/checkout$/))) {
    const q = db.quotes[r[1]];
    if (!q) return json(res, 404, { error: 'No such quote.' });
    const existing = q.licenseId && db.licenses[q.licenseId];
    if (existing && existing.status !== 'AWAITING_PAYMENT') return json(res, 409, { error: 'This quote is already paid.', licenseId: existing.id });
    const { license, approveUrl } = await checkout(q, { origin: origin(req) });
    q.licenseId = license.id;
    save();
    return json(res, 201, { licenseId: license.id, approveUrl });
  }

  if (req.method === 'GET' && p === '/api/licenses') return json(res, 200, Object.values(db.licenses).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(view));
  if (req.method === 'GET' && (r = m(/^\/api\/licenses\/([\w-]+)$/))) {
    const l = db.licenses[r[1]];
    return l ? json(res, 200, view(l)) : json(res, 404, { error: 'No such license.' });
  }
  if (req.method === 'GET' && (r = m(/^\/api\/licenses\/([\w-]+)\/stream$/))) {
    const l = db.licenses[r[1]];
    if (!l) return json(res, 404, { error: 'No such license.' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify(view(l))}\n\n`);
    const off = subscribe(l.id, res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => { off(); clearInterval(ping); });
    return;
  }

  // Refund the capture (payouts mode only: in split mode each collaborator holds their own capture).
  if (req.method === 'POST' && (r = m(/^\/api\/licenses\/([\w-]+)\/refund$/))) {
    const l = db.licenses[r[1]];
    if (!l) return json(res, 404, { error: 'No such license.' });
    if (l.payMode !== 'payouts') return json(res, 409, { error: 'Split-paid licenses are refunded by each collaborator from their own PayPal account.' });
    const capId = Object.entries(l.captures).find(([, c]) => c.status === 'COMPLETED')?.[0];
    if (!capId) return json(res, 409, { error: 'There is no completed payment to refund.' });
    await paypal('refund', 'POST', `/v2/payments/captures/${capId}/refund`, { note_to_payer: `UsagePass license ${l.id} refunded; the license is revoked.` }, { requestId: `refund-${l.id}` });
    return json(res, 202, { ok: true, note: 'Refund sent. The license revokes when PayPal confirms it.' });
  }

  if (req.method === 'GET' && p === '/paypal/return') {
    const l = db.licenses[url.searchParams.get('license')];
    if (!l) return redirect(res, '/#/licenses');
    if (url.searchParams.get('token') && url.searchParams.get('token') !== l.orderId) return redirect(res, `/#/licenses/${l.id}?stale=1`);
    try { await captureOnReturn(l); } catch (e) { console.error(e.message); return redirect(res, `/#/licenses/${l.id}?error=${encodeURIComponent(e.message.slice(0, 160))}`); }
    return redirect(res, `/#/licenses/${l.id}`);
  }
  if (req.method === 'GET' && p === '/paypal/cancel') {
    const l = db.licenses[url.searchParams.get('license')];
    if (!l) return redirect(res, '/');
    cancelled(l);
    return redirect(res, `/#/quotes/${l.quoteId}?cancelled=1`);
  }

  if (req.method === 'POST' && (p === '/webhooks/paypal' || p === '/')) {
    const raw = await body(req, 1024 * 1024);
    let event;
    try { event = JSON.parse(raw); } catch { return json(res, 400, { error: 'invalid JSON' }); }
    const v = await verifyWebhook(req.headers, raw);
    console.log(`← ${event.event_type} ${event.id} ${v.ok ? 'verified' : `NOT verified (${v.why})`}`);
    if (!v.ok && process.env.ALLOW_UNVERIFIED !== '1') return json(res, 401, { error: 'signature not verified' });
    const out = await applyEvent(event);
    console.log(`  ${out}`);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET') return serveStatic(res, p);
  json(res, 404, { error: 'Not found.' });
}

async function serveStatic(res, p) {
  const rel = normalize(p === '/' ? '/index.html' : decodeURIComponent(p)).replace(/^([/\\])+/, '');
  if (rel.startsWith('..')) return json(res, 400, { error: 'Bad path.' });
  try {
    const file = await readFile(join(PUBLIC, rel));
    res.writeHead(200, { 'Content-Type': TYPES[extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(file);
  } catch {
    json(res, 404, { error: 'Not found.' });
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    await route(req, res, url);
  } catch (e) {
    console.error(e instanceof PayPalError ? e.message : e);
    if (!res.headersSent) json(res, e.status || 500, { error: e.status ? e.message : e instanceof PayPalError ? e.message : 'Something went wrong on our side.' });
  }
}).listen(PORT, () => {
  console.log(`UsagePass on http://localhost:${PORT}  · AI: ${env('GEMINI_API_KEY') ? 'Gemini' : 'offline reader (set GEMINI_API_KEY)'} · webhook: ${env('PAYPAL_WEBHOOK_ID') ? 'verifying' : 'PAYPAL_WEBHOOK_ID not set'}`);
});
