#!/usr/bin/env node
// RightsRail webhook receiver.
// PayPal posts events here; each one is signature-verified with PayPal before it may change anything.
// License state is driven only by verified events:
//   CHECKOUT.ORDER.APPROVED     → PENDING
//   PAYMENT.CAPTURE.COMPLETED   → ACTIVE once every purchase unit of the order is captured
//                                 (PARTIALLY_PAID in between, for multi-payee orders)
//   PAYMENT.CAPTURE.PENDING     → PAYMENT_HELD   (PayPal is holding the money: not usable yet)
//   PAYMENT.CAPTURE.DENIED      → DENIED
//   PAYMENT.CAPTURE.REFUNDED    → REVOKED        (refund or chargeback ends the right to use the work)
//   PAYMENT.CAPTURE.REVERSED    → REVOKED
//   PAYMENT.PAYOUTS-ITEM.*      → records each collaborator's payout status on the license
//
// Endpoints: POST /webhooks/paypal (or /), GET / (live table), GET /licenses, GET /licenses/:id, GET /healthz
// Usage: node receiver.mjs   (PORT, default 5175; needs PAYPAL_CLIENT_ID/SECRET and PAYPAL_WEBHOOK_ID)

import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, PayPalError, api, env, findWebhook, saveLog } from './paypal.mjs';

const PORT = Number(process.env.PORT || 5175);
const ALLOW_UNVERIFIED = process.env.ALLOW_UNVERIFIED === '1'; // local testing only: never in a deployed receiver
const DATA_DIR = process.env.RECEIVER_DATA_DIR || join(HERE, 'data');
const STATE_FILE = join(DATA_DIR, 'state.json');
const MAX_BODY = 1024 * 1024;

// ---------- state ----------

const state = existsSync(STATE_FILE)
  ? JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  : { licenses: {}, seenEvents: [] };
const seen = new Set(state.seenEvents);

function persist() {
  mkdirSync(DATA_DIR, { recursive: true });
  state.seenEvents = [...seen].slice(-5000);
  const tmp = `${STATE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, STATE_FILE);
}

function license(id) {
  state.licenses[id] ??= { id, status: 'UNKNOWN', orderId: null, captures: {}, payouts: {}, history: [], updatedAt: null };
  return state.licenses[id];
}

function transition(lic, to, event, note) {
  const from = lic.status;
  if (from === 'REVOKED') to = 'REVOKED'; // revocation is final
  lic.history.push({ at: new Date().toISOString(), event: event.event_type, eventId: event.id, from, to, ...(note ? { note } : {}) });
  lic.status = to;
  lic.updatedAt = new Date().toISOString();
  console.log(`  ${lic.id}: ${from} → ${to}${note ? ` (${note})` : ''}`);
}

// ---------- PayPal lookups ----------

// Refund and reversal events carry a refund resource; its "up" link points at the capture,
// which carries our custom_id (the license id).
async function captureFor(resource) {
  const up = resource.links?.find((l) => l.rel === 'up')?.href;
  const id = up?.match(/captures\/([^/?]+)/)?.[1];
  if (!id) return null;
  const { data } = await api('receiver-capture-get', 'GET', `/v2/payments/captures/${id}`, null, { allowFail: true });
  return data?.id ? data : null;
}

// How many purchase units this license's order has, so a multi-payee order only
// activates when every collaborator's share is captured.
async function expectedCaptures(orderId, licenseId) {
  if (!orderId) return 1;
  const { data } = await api('receiver-order-get', 'GET', `/v2/checkout/orders/${orderId}`, null, { allowFail: true });
  const units = (data.purchase_units || []).filter((pu) => (pu.custom_id || pu.reference_id) === licenseId);
  return units.length || 1;
}

// ---------- event handling ----------

async function apply(event) {
  const r = event.resource || {};
  switch (event.event_type) {
    case 'CHECKOUT.ORDER.APPROVED': {
      const id = r.purchase_units?.find((pu) => pu.custom_id)?.custom_id;
      if (!id) return 'no custom_id on order';
      const lic = license(id);
      lic.orderId = r.id;
      lic.amount ??= r.purchase_units.reduce((s, pu) => s + Number(pu.amount?.value || 0), 0).toFixed(2);
      if (lic.status === 'UNKNOWN') transition(lic, 'PENDING', event, 'buyer approved, not yet captured');
      return `license ${id}`;
    }
    case 'PAYMENT.CAPTURE.COMPLETED':
    case 'PAYMENT.CAPTURE.PENDING':
    case 'PAYMENT.CAPTURE.DENIED': {
      const id = r.custom_id;
      if (!id) return 'no custom_id on capture';
      const lic = license(id);
      lic.orderId ??= r.supplementary_data?.related_ids?.order_id || null;
      lic.captures[r.id] = {
        status: r.status,
        amount: r.amount?.value,
        net: r.seller_receivable_breakdown?.net_amount?.value,
        payee: r.payee?.email_address || null,
        reason: r.status_details?.reason || null,
      };
      if (event.event_type === 'PAYMENT.CAPTURE.DENIED') transition(lic, 'DENIED', event);
      else if (event.event_type === 'PAYMENT.CAPTURE.PENDING') transition(lic, 'PAYMENT_HELD', event, r.status_details?.reason);
      else {
        const expected = await expectedCaptures(lic.orderId, id);
        const done = Object.values(lic.captures).filter((c) => c.status === 'COMPLETED').length;
        lic.amount = Object.values(lic.captures).reduce((s, c) => s + Number(c.amount || 0), 0).toFixed(2);
        if (done >= expected) transition(lic, 'ACTIVE', event, `${done}/${expected} captured`);
        else transition(lic, 'PARTIALLY_PAID', event, `${done}/${expected} captured`);
      }
      return `license ${id}`;
    }
    case 'PAYMENT.CAPTURE.REFUNDED':
    case 'PAYMENT.CAPTURE.REVERSED': {
      const cap = r.custom_id ? null : await captureFor(r);
      const id = r.custom_id || cap?.custom_id;
      if (!id) return 'could not find license for refund';
      transition(license(id), 'REVOKED', event, `${event.event_type === 'PAYMENT.CAPTURE.REVERSED' ? 'reversal' : 'refund'} $${r.amount?.value}`);
      return `license ${id}`;
    }
    case 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED':
    case 'PAYMENT.PAYOUTS-ITEM.FAILED': {
      const senderItem = r.payout_item?.sender_item_id || '';
      const id = senderItem.replace(/-\d+$/, '');
      if (!id.startsWith('LIC-')) return 'payout item not linked to a license';
      const lic = license(id);
      lic.payouts[r.payout_item_id] = {
        receiver: r.payout_item?.receiver,
        amount: r.payout_item?.amount?.value,
        status: r.transaction_status,
        error: r.errors?.name || null,
      };
      lic.updatedAt = new Date().toISOString();
      console.log(`  ${id}: payout to ${r.payout_item?.receiver} ${r.transaction_status}`);
      return `license ${id}`;
    }
    default:
      return 'ignored';
  }
}

// ---------- signature verification ----------

let webhookId = env('PAYPAL_WEBHOOK_ID', { optional: true });

// The event is passed to PayPal as the exact bytes received; re-serialising parsed JSON
// can change number formatting or key order and make a genuine event fail verification.
async function verify(headers, rawBody) {
  if (!webhookId) return { ok: false, why: 'no PAYPAL_WEBHOOK_ID configured' };
  const h = (name) => headers[name] || '';
  if (!h('paypal-transmission-sig')) return { ok: false, why: 'no PayPal signature headers' };
  const envelope = JSON.stringify({
    auth_algo: h('paypal-auth-algo'),
    cert_url: h('paypal-cert-url'),
    transmission_id: h('paypal-transmission-id'),
    transmission_sig: h('paypal-transmission-sig'),
    transmission_time: h('paypal-transmission-time'),
    webhook_id: webhookId,
    webhook_event: '__EVENT__',
  }).replace('"__EVENT__"', () => rawBody);
  const { data } = await api('receiver-verify', 'POST', '/v1/notifications/verify-webhook-signature', null, { allowFail: true, rawBody: envelope });
  return { ok: data.verification_status === 'SUCCESS', why: data.verification_status || data.name || 'verification call failed' };
}

// ---------- http ----------

// One event at a time, so concurrent captures of a multi-payee order cannot race.
let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn, fn));

async function handleWebhook(req, res) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > MAX_BODY) return send(res, 413, { error: 'body too large' });
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  let event;
  try { event = JSON.parse(raw); } catch { return send(res, 400, { error: 'invalid JSON' }); }

  const v = await verify(req.headers, raw);
  console.log(`\n← ${event.event_type} ${event.id}  signature: ${v.ok ? 'verified' : `NOT verified (${v.why})`}`);
  saveLog('receiver-event', { verified: v.ok, why: v.why, headers: pick(req.headers, /^paypal-/), event });
  if (!v.ok && !ALLOW_UNVERIFIED) return send(res, 401, { error: 'signature not verified' });

  try {
    // The duplicate check runs inside the queue: PayPal can redeliver an event while the first copy is still being applied.
    const result = await serial(async () => {
      if (seen.has(event.id)) return 'duplicate';
      const out = await apply(event);
      seen.add(event.id);
      persist();
      return out;
    });
    console.log(`  ${result === 'duplicate' ? 'duplicate delivery, already applied' : result}`);
    send(res, 200, { ok: true, result, ...(result === 'duplicate' ? { duplicate: true } : {}) });
  } catch (e) {
    // Non-2xx makes PayPal retry the delivery later.
    console.error(`  failed: ${e.message}`);
    send(res, 500, { error: 'processing failed' });
  }
}

function pick(obj, re) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => re.test(k)));
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = { ACTIVE: '#137333', PENDING: '#9a6700', PARTIALLY_PAID: '#9a6700', PAYMENT_HELD: '#9a6700', DENIED: '#b3261e', REVOKED: '#b3261e' };

function page() {
  const rows = Object.values(state.licenses)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .map((l) => {
      const caps = Object.entries(l.captures).map(([id, c]) => `${esc(c.payee || 'seller')}: $${esc(c.amount)} ${esc(c.status)}`).join('<br>');
      const pays = Object.values(l.payouts).map((p) => `${esc(p.receiver)}: $${esc(p.amount)} ${esc(p.status)}`).join('<br>');
      const last = l.history.at(-1);
      return `<tr><td><code>${esc(l.id)}</code></td><td><b style="color:${COLORS[l.status] || '#555'}">${esc(l.status)}</b></td><td>$${esc(l.amount)}</td><td>${caps || '—'}</td><td>${pays || '—'}</td><td>${esc(last?.event)}<br><small>${esc(last?.at)}</small></td></tr>`;
    }).join('');
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="2">
<title>RightsRail receiver</title>
<style>body{font:14px system-ui,sans-serif;margin:24px;color:#1f1f1f;background:#fff}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}th{font-weight:600;color:#555}code{font-size:13px}.wrap{overflow-x:auto}</style>
<h1>RightsRail licenses</h1>
<p>State changes only from signature-verified PayPal webhooks. Refreshes every 2 seconds.${ALLOW_UNVERIFIED ? ' <b style="color:#b3261e">ALLOW_UNVERIFIED is on: local testing only.</b>' : ''}</p>
<div class="wrap"><table><tr><th>License</th><th>Status</th><th>Paid</th><th>Captures</th><th>Collaborator payouts</th><th>Last event</th></tr>${rows || '<tr><td colspan="6">No licenses yet.</td></tr>'}</table></div>`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'POST' && (url.pathname === '/webhooks/paypal' || url.pathname === '/')) return await handleWebhook(req, res);
    if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, { ok: true, webhookId: webhookId || null, licenses: Object.keys(state.licenses).length });
    if (req.method === 'GET' && url.pathname === '/licenses') return send(res, 200, Object.values(state.licenses));
    const m = url.pathname.match(/^\/licenses\/([A-Za-z0-9-]+)$/);
    if (req.method === 'GET' && m) return state.licenses[m[1]] ? send(res, 200, state.licenses[m[1]]) : send(res, 404, { error: 'unknown license' });
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page());
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: 'internal error' });
  }
});

async function start() {
  if (!webhookId && env('WEBHOOK_URL', { optional: true })) {
    try {
      const hook = await findWebhook();
      if (hook) { webhookId = hook.id; console.log(`Using webhook ${hook.id} found for WEBHOOK_URL (set PAYPAL_WEBHOOK_ID=${hook.id} to skip this lookup).`); }
    } catch (e) {
      console.error(e instanceof PayPalError ? e.message : e);
    }
  }
  if (!webhookId) console.log(`! No PAYPAL_WEBHOOK_ID: every event will be rejected${ALLOW_UNVERIFIED ? ' by verification, then applied anyway (ALLOW_UNVERIFIED=1)' : ''}. Run: node spike.mjs webhook-setup`);
  server.listen(PORT, () => console.log(`RightsRail receiver on http://localhost:${PORT}  (POST /webhooks/paypal, GET / for the license table)`));
}
start();
