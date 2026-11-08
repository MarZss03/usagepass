// PayPal sandbox client: env loading, OAuth with refresh, logged REST calls.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
export const ROOT = join(APP_DIR, '..');
const BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';
const LOG_DIR = join(APP_DIR, 'data', 'logs');

// Root .env first, then spike/.env for anything still unset (the spike already holds sandbox credentials).
for (const file of [join(ROOT, '.env'), join(ROOT, 'spike', '.env')]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2] && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export class PayPalError extends Error {
  constructor(message, details = {}) { super(message); Object.assign(this, details); }
}

export const env = (name, fallback = '') => process.env[name] || fallback;

let logSeq = 0;
function saveLog(step, payload) {
  if (process.env.PAYPAL_LOG === '0') return null;
  mkdirSync(LOG_DIR, { recursive: true });
  const file = join(LOG_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}-${String(++logSeq).padStart(3, '0')}-${step}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

let cached = null;
async function token() {
  if (cached && Date.now() < cached.expiresAt) return cached.data;
  const id = env('PAYPAL_CLIENT_ID');
  const secret = env('PAYPAL_CLIENT_SECRET');
  if (!id || !secret) throw new PayPalError('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not set.');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new PayPalError(`PayPal sign-in failed (${res.status}): ${data.error_description || data.error || 'unknown'}`);
  cached = { data, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return data;
}

// rawBody sends a pre-serialised JSON string unchanged (webhook signature verification needs the exact bytes).
export async function paypal(step, method, path, body, { allowFail = false, requestId, rawBody } = {}) {
  const t = await token();
  const headers = { Authorization: `Bearer ${t.access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (method === 'POST' && requestId !== false) headers['PayPal-Request-Id'] = requestId || randomUUID();
  const res = await fetch(`${BASE}${path}`, { method, headers, body: rawBody ?? (body ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  const debugId = res.headers.get('paypal-debug-id');
  saveLog(step, { request: { method, path, body: body ?? (rawBody ? '(raw)' : undefined) }, status: res.status, debugId, response: data });
  if (!res.ok && !allowFail) {
    const detail = data.details?.map((d) => d.issue + (d.description ? `: ${d.description}` : '')).join('; ');
    throw new PayPalError(`${method} ${path} failed (${res.status} ${data.name || ''}) ${detail || data.message || ''}`.trim(), { status: res.status, debugId, name: data.name });
  }
  return { status: res.status, data, debugId };
}

export const link = (data, ...rels) => data.links?.find((l) => rels.includes(l.rel))?.href;

export const WEBHOOK_EVENTS = [
  'CHECKOUT.ORDER.APPROVED',
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.PENDING',
  'PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.REFUNDED',
  'PAYMENT.CAPTURE.REVERSED',
  'PAYMENT.PAYOUTSBATCH.SUCCESS',
  'PAYMENT.PAYOUTS-ITEM.SUCCEEDED',
  'PAYMENT.PAYOUTS-ITEM.FAILED',
];

// Verifies a webhook with PayPal, passing the event exactly as received.
export async function verifyWebhook(headers, rawBody) {
  const webhookId = env('PAYPAL_WEBHOOK_ID');
  if (!webhookId) return { ok: false, why: 'PAYPAL_WEBHOOK_ID is not set' };
  const h = (n) => headers[n] || '';
  if (!h('paypal-transmission-sig')) return { ok: false, why: 'no PayPal signature headers' };
  const envelope = JSON.stringify({
    auth_algo: h('paypal-auth-algo'), cert_url: h('paypal-cert-url'), transmission_id: h('paypal-transmission-id'),
    transmission_sig: h('paypal-transmission-sig'), transmission_time: h('paypal-transmission-time'),
    webhook_id: webhookId, webhook_event: '__EVENT__',
  }).replace('"__EVENT__"', () => rawBody);
  const { data } = await paypal('verify-webhook', 'POST', '/v1/notifications/verify-webhook-signature', null, { allowFail: true, rawBody: envelope });
  return { ok: data.verification_status === 'SUCCESS', why: data.verification_status || data.name || 'verification call failed' };
}
