// Shared sandbox client for spike.mjs and receiver.mjs: .env loading, OAuth, logged API calls.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const BASE = 'https://api-m.sandbox.paypal.com';
export const LOG_DIR = join(HERE, 'logs');

(function loadEnv() {
  const file = join(HERE, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

export class PayPalError extends Error {}

export function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}
export function ok(msg) { console.log(`✓ ${msg}`); }
export function info(msg) { console.log(`  ${msg}`); }
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const env = (name, { optional = false } = {}) => {
  const v = process.env[name];
  if (!v && !optional) throw new PayPalError(`Missing ${name} in spike/.env (copy .env.example to .env and fill it in).`);
  return v || '';
};

let logSeq = 0;
export function saveLog(step, payload) {
  mkdirSync(LOG_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(LOG_DIR, `${stamp}-${String(++logSeq).padStart(2, '0')}-${step}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

// Cached until a minute before expiry, so a long-running receiver keeps working.
let cached = null;
export async function token() {
  if (cached && Date.now() < cached.expiresAt) return cached.data;
  const id = env('PAYPAL_CLIENT_ID');
  const secret = env('PAYPAL_CLIENT_SECRET');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new PayPalError(`OAuth failed (${res.status}): ${data.error_description || data.error || 'unknown'}. Check the sandbox Client ID/Secret.`);
  cached = { data, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return data;
}

// `rawBody` sends a pre-serialised JSON string as-is (used for signature verification,
// where the webhook event must reach PayPal byte-for-byte as it was received).
export async function api(step, method, path, body, { allowFail = false, idempotent = true, rawBody } = {}) {
  const t = await token();
  const headers = {
    Authorization: `Bearer ${t.access_token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  if (method === 'POST' && idempotent) headers['PayPal-Request-Id'] = randomUUID();
  const payload = rawBody ?? (body ? JSON.stringify(body) : undefined);
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  const debugId = res.headers.get('paypal-debug-id');
  const file = saveLog(step, { request: { method, path, body: body ?? (rawBody ? '(raw)' : undefined) }, status: res.status, debugId, response: data });
  if (!res.ok && !allowFail) {
    const detail = data.details?.map((d) => `${d.issue}${d.description ? `: ${d.description}` : ''}`).join('; ');
    throw new PayPalError(`${method} ${path} → ${res.status} ${data.name || ''} ${detail || data.message || ''}\n  debug id: ${debugId}\n  log: ${file}`);
  }
  return { status: res.status, data, debugId, file };
}

export const link = (data, ...rels) => data.links?.find((l) => rels.includes(l.rel))?.href;

// Event types RightsRail reacts to. Refunds and reversals (chargebacks) revoke the license.
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

// Finds this app's webhook by PAYPAL_WEBHOOK_ID, or by WEBHOOK_URL when no id is set.
export async function findWebhook() {
  const { data } = await api('webhooks-list', 'GET', '/v1/notifications/webhooks');
  const list = data.webhooks || [];
  const id = env('PAYPAL_WEBHOOK_ID', { optional: true });
  const url = env('WEBHOOK_URL', { optional: true });
  return list.find((w) => (id ? w.id === id : w.url === url)) || null;
}
