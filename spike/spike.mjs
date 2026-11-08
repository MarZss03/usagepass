#!/usr/bin/env node
// RightsRail sandbox spike.
// Proves four things against the PayPal sandbox before any product code is written:
//   1. Orders v2: a license order with itemised rights is created, approved by a buyer, captured.
//   2. Webhooks: PayPal records a PAYMENT.CAPTURE.COMPLETED event for that capture.
//   3. Payouts: the net amount is split 70/20/10 and paid to three collaborators by email.
//   4. Multi-payee checkout: one order with three purchase_units, each with its own payee.
// Every request and response is saved to ./logs so failures can be read later (with paypal-debug-id).
//
// Usage: node spike.mjs <doctor|run|order|capture <orderId>|payout <captureId>|webhook-setup|webhook-events <captureId>|split>

import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import {
  LOG_DIR, PayPalError, WEBHOOK_EVENTS, api, env, fail, findWebhook, info, link, ok, sleep, token,
} from './paypal.mjs';

const RETURN_PORT = 5174;

// The license being sold in the demo. Prices come from the seller's rate card, not from the AI.
const LICENSE = {
  id: `LIC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 6).toUpperCase()}`,
  work: 'Spring launch poster (AI-assisted)',
  scope: 'Paid ads on Instagram + TikTok, CA + US, 90 days, captions editable, no model training',
  lines: [
    { name: 'Base creative license', value: '200.00' },
    { name: 'Paid advertising, 90 days', value: '80.00' },
    { name: 'Additional territory: United States', value: '30.00' },
  ],
  split: [
    { role: 'Lead designer', emailVar: 'PAYEE_LEAD_EMAIL', pct: 70 },
    { role: 'Animator', emailVar: 'PAYEE_ANIMATOR_EMAIL', pct: 20 },
    { role: 'Voice artist', emailVar: 'PAYEE_VOICE_EMAIL', pct: 10 },
  ],
};
const TOTAL = LICENSE.lines.reduce((s, l) => s + toCents(l.value), 0);

// ---------- helpers ----------

function toCents(v) { return Math.round(Number(v) * 100); }
function money(c) { return (c / 100).toFixed(2); }

function splitCents(total, shares) {
  const parts = shares.map((s) => Math.floor((total * s.pct) / 100));
  parts[0] += total - parts.reduce((a, b) => a + b, 0); // rounding remainder to the lead
  return parts;
}

// Where the running receiver can be asked for license state: RECEIVER_URL, else WEBHOOK_URL's origin.
function receiverBase() {
  const explicit = env('RECEIVER_URL', { optional: true });
  if (explicit) return explicit.replace(/\/$/, '');
  const hook = env('WEBHOOK_URL', { optional: true });
  return hook ? new URL(hook).origin : '';
}

// ---------- buyer approval ----------

// Starts a tiny local page for PayPal's return_url and also polls the order,
// so approval is detected whichever happens first.
async function waitForApproval(orderId, approveUrl) {
  console.log(`\n→ Open this link and pay with a SANDBOX PERSONAL (buyer) account:\n\n  ${approveUrl}\n`);
  info('Waiting up to 10 minutes for approval…');
  let server;
  const returned = new Promise((resolve) => {
    server = createServer((req, res) => {
      // PayPal appends ?token=<orderId>. An old checkout tab returning here must not count as this order.
      const token = new URL(req.url, 'http://x').searchParams.get('token');
      const mine = req.url.startsWith('/return') && token === orderId;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(mine ? '<h2>Approved. Go back to the terminal.</h2>' : `<h2>This return is for order ${String(token).replace(/[^A-Z0-9]/gi, '')}, not ${orderId}. Use the newest link from the terminal.</h2>`);
      if (mine) resolve('return');
      else if (token) console.log(`! A PayPal return arrived for a different order (${token}); still waiting for ${orderId}.`);
    });
    server.on('error', () => {}); // port busy: polling still works
    server.listen(RETURN_PORT);
  });
  let gotReturn = false;
  returned.then(() => { gotReturn = true; });
  const deadline = Date.now() + 10 * 60 * 1000;
  try {
    while (Date.now() < deadline) {
      await (gotReturn ? sleep(2000) : Promise.race([returned, sleep(4000)]));
      const { data } = await api('order-status', 'GET', `/v2/checkout/orders/${orderId}`);
      if (data.status === 'APPROVED' || data.status === 'COMPLETED') return data;
      if (gotReturn) info(`Returned from PayPal but order status is ${data.status}; still waiting…`);
    }
  } finally {
    server?.close();
  }
  fail('Timed out waiting for buyer approval.');
}

// ---------- steps ----------

async function doctor() {
  const t = await token();
  ok(`Sandbox OAuth works (app id ${t.app_id || 'n/a'}, token expires in ${t.expires_in}s)`);
  const scopes = (t.scope || '').split(' ');
  const has = (frag) => scopes.some((s) => s.includes(frag));
  for (const [label, frag] of [
    ['Checkout / Orders', 'payments/payment'],
    ['Payouts', 'payments/payouts'],
    ['Webhooks', 'webhook'],
  ]) {
    has(frag) ? ok(`Token scope covers ${label}`) : console.log(`! Token scope does not mention ${label} (may still work; if a step fails, enable the feature on the sandbox app).`);
  }
  for (const s of LICENSE.split) {
    env(s.emailVar, { optional: true }) ? ok(`${s.emailVar} set`) : console.log(`! ${s.emailVar} not set (needed for payout and split steps)`);
  }
  const hook = await findWebhook();
  if (!hook) {
    console.log('! No RightsRail webhook registered yet (set WEBHOOK_URL, then run: node spike.mjs webhook-setup)');
  } else {
    const names = new Set(hook.event_types.map((e) => e.name));
    const missing = WEBHOOK_EVENTS.filter((n) => !names.has(n) && !names.has('*'));
    ok(`Webhook ${hook.id} → ${hook.url}`);
    if (missing.length) console.log(`! Webhook is missing ${missing.join(', ')} (re-run: node spike.mjs webhook-setup)`);
    if (env('PAYPAL_WEBHOOK_ID', { optional: true }) !== hook.id) console.log(`! Set PAYPAL_WEBHOOK_ID=${hook.id} in .env (the receiver needs it to verify signatures)`);
  }
  const base = receiverBase();
  if (base) {
    const res = await fetch(`${base}/healthz`).catch(() => null);
    res?.ok ? ok(`Receiver reachable at ${base}`) : console.log(`! Receiver not reachable at ${base}/healthz (start it: node receiver.mjs)`);
  }
}

function orderBody({ multiPayee = false } = {}) {
  const items = LICENSE.lines.map((l) => ({
    name: l.name,
    quantity: '1',
    unit_amount: { currency_code: 'USD', value: l.value },
    category: 'DIGITAL_GOODS',
  }));
  const experience = {
    brand_name: 'RightsRail (sandbox)',
    user_action: 'PAY_NOW',
    shipping_preference: 'NO_SHIPPING',
    return_url: `http://localhost:${RETURN_PORT}/return`,
    cancel_url: `http://localhost:${RETURN_PORT}/cancel`,
  };
  if (!multiPayee) {
    return {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: LICENSE.id,
        custom_id: LICENSE.id,
        invoice_id: LICENSE.id,
        description: LICENSE.scope.slice(0, 127),
        amount: { currency_code: 'USD', value: money(TOTAL), breakdown: { item_total: { currency_code: 'USD', value: money(TOTAL) } } },
        items,
      }],
      payment_source: { paypal: { experience_context: experience } },
    };
  }
  const parts = splitCents(TOTAL, LICENSE.split);
  return {
    intent: 'CAPTURE',
    purchase_units: LICENSE.split.map((s, i) => ({
      reference_id: `${LICENSE.id}-${i + 1}`,
      custom_id: LICENSE.id,
      description: `${s.role} share (${s.pct}%) of ${LICENSE.id}`.slice(0, 127),
      payee: { email_address: env(s.emailVar) },
      amount: { currency_code: 'USD', value: money(parts[i]) },
    })),
    payment_source: { paypal: { experience_context: experience } },
  };
}

async function createOrder(opts = {}) {
  const body = orderBody(opts);
  const { data } = await api(opts.multiPayee ? 'split-order-create' : 'order-create', 'POST', '/v2/checkout/orders', body);
  ok(`Order ${data.id} created, status ${data.status}, total $${money(TOTAL)} (${LICENSE.id})`);
  const approve = link(data, 'payer-action', 'approve');
  if (!approve) fail('No approval link in the order response.');
  return { order: data, approve };
}

async function capture(orderId) {
  const { data } = await api('order-capture', 'POST', `/v2/checkout/orders/${orderId}/capture`, {});
  const caps = (data.purchase_units || []).flatMap((pu) => pu.payments?.captures || []);
  if (!caps.length) fail('Capture response contained no captures.');
  ok(`Order ${data.id} status ${data.status}`);
  for (const c of caps) {
    const b = c.seller_receivable_breakdown;
    info(`capture ${c.id}: ${c.status} $${c.amount.value}` + (b ? ` (fee $${b.paypal_fee?.value}, net $${b.net_amount?.value})` : '') + (c.status_details?.reason ? ` reason ${c.status_details.reason}` : ''));
  }
  return { order: data, captures: caps };
}

async function payout(captureId) {
  const { data: cap } = await api('capture-get', 'GET', `/v2/payments/captures/${captureId}`);
  if (cap.status !== 'COMPLETED') console.log(`! Capture status is ${cap.status}; paying out anyway for the spike.`);
  const net = toCents(cap.seller_receivable_breakdown?.net_amount?.value ?? cap.amount.value);
  const parts = splitCents(net, LICENSE.split);
  const licenseId = cap.custom_id || LICENSE.id;
  const body = {
    sender_batch_header: {
      sender_batch_id: `${licenseId}-${Date.now()}`,
      email_subject: 'RightsRail: your share of a license sale',
      email_message: `License ${licenseId} was purchased. This is your agreed share.`,
    },
    items: LICENSE.split.map((s, i) => ({
      recipient_type: 'EMAIL',
      receiver: env(s.emailVar),
      amount: { value: money(parts[i]), currency: 'USD' },
      note: `${s.role} share (${s.pct}%) of ${licenseId}, capture ${captureId}`,
      sender_item_id: `${licenseId}-${i + 1}`,
    })),
  };
  info(`Splitting net $${money(net)}: ${LICENSE.split.map((s, i) => `${s.role} $${money(parts[i])}`).join(', ')}`);
  const { data } = await api('payout-create', 'POST', '/v1/payments/payouts', body, { idempotent: false });
  const batchId = data.batch_header?.payout_batch_id;
  ok(`Payout batch ${batchId} submitted, status ${data.batch_header?.batch_status}`);
  for (let i = 0; i < 30; i++) {
    await sleep(4000);
    const { data: b } = await api('payout-status', 'GET', `/v1/payments/payouts/${batchId}`);
    const st = b.batch_header?.batch_status;
    if (!['PENDING', 'PROCESSING'].includes(st)) {
      ok(`Payout batch ${batchId} → ${st}`);
      for (const it of b.items || []) info(`${it.payout_item?.receiver}: ${it.transaction_status} $${it.payout_item?.amount?.value} (item ${it.payout_item_id})${it.errors ? ` error ${it.errors.name}` : ''}`);
      return b;
    }
    info(`batch ${st}…`);
  }
  console.log('! Payout batch still processing after 2 minutes; check later with the batch id above.');
}

async function webhookSetup() {
  const url = env('WEBHOOK_URL');
  if (!url.startsWith('https://')) fail('WEBHOOK_URL must be an https URL you control (PayPal posts sandbox event payloads to it).');
  const event_types = WEBHOOK_EVENTS.map((name) => ({ name }));
  let hook = await findWebhook();
  if (hook && hook.url !== url) {
    // PAYPAL_WEBHOOK_ID points at an older URL (e.g. a tunnel that changed): move it.
    await api('webhook-update', 'PATCH', `/v1/notifications/webhooks/${hook.id}`, [{ op: 'replace', path: '/url', value: url }]);
    ok(`Webhook ${hook.id} moved to ${url}`);
  }
  if (!hook) {
    const { data } = await api('webhook-create', 'POST', '/v1/notifications/webhooks', { url, event_types }, { allowFail: true });
    if (data.id) hook = data;
    else if (data.name === 'WEBHOOK_URL_ALREADY_EXISTS') hook = (await api('webhooks-list', 'GET', '/v1/notifications/webhooks')).data.webhooks.find((w) => w.url === url);
    else fail(`Webhook registration failed: ${data.name} ${data.message || ''}`);
  }
  const { data: patched } = await api('webhook-update', 'PATCH', `/v1/notifications/webhooks/${hook.id}`, [{ op: 'replace', path: '/event_types', value: event_types }], { allowFail: true });
  if (patched.name && patched.name !== 'WEBHOOK_PATCH_REQUEST_NO_CHANGE') fail(`Updating webhook event types failed: ${patched.name} ${patched.message || ''}`);
  ok(`Webhook ${hook.id} → ${url}, subscribed to ${WEBHOOK_EVENTS.length} event types`);
  if (env('PAYPAL_WEBHOOK_ID', { optional: true }) !== hook.id) info(`Now add this line to .env and restart the receiver:\n\n  PAYPAL_WEBHOOK_ID=${hook.id}\n`);
}

// Asks the receiver for the license until PayPal's capture webhook has activated it.
// This is the real proof: an event delivered to our server, signature-verified, changed state.
async function waitForLicense(licenseId, { want = 'ACTIVE', seconds = 60 } = {}) {
  const base = receiverBase();
  if (!base) { console.log('! No RECEIVER_URL / WEBHOOK_URL set: skipping delivered-webhook check'); return null; }
  const deadline = Date.now() + seconds * 1000;
  let last;
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/licenses/${licenseId}`).catch(() => null);
    if (res?.ok) {
      last = await res.json();
      if (last.status === want) {
        ok(`Receiver: ${licenseId} is ${last.status} (set by verified ${last.history.at(-1)?.event} webhook)`);
        return last;
      }
    }
    await sleep(3000);
  }
  console.log(`! After ${seconds}s the receiver shows ${licenseId} as ${last?.status || 'unknown'}, not ${want}. Check the receiver's console and ${base}/`);
  return last;
}

// Reads PayPal's own record of events it generated for this app, so the spike
// can confirm the capture event without running a public server.
async function webhookEvents(captureId, { waitSeconds = 90 } = {}) {
  // PayPal's webhooks-events endpoint rejects fractional seconds even though
  // JavaScript's ISO output is otherwise valid RFC 3339.
  const start = new Date(Date.now() - 60 * 60 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z');
  const deadline = Date.now() + waitSeconds * 1000;
  while (true) {
    const { data } = await api('webhook-events', 'GET', `/v1/notifications/webhooks-events?event_type=PAYMENT.CAPTURE.COMPLETED&start_time=${encodeURIComponent(start)}&page_size=50`);
    const hit = (data.events || []).find((e) => e.resource?.id === captureId);
    if (hit) {
      ok(`PayPal recorded ${hit.event_type} (event ${hit.id}) for capture ${captureId}, delivery status ${hit.status || 'n/a'}`);
      info(`custom_id on the event: ${hit.resource?.custom_id} → this is what flips the license from Pending to Active`);
      return hit;
    }
    if (Date.now() > deadline) {
      console.log(`! No PAYMENT.CAPTURE.COMPLETED event for ${captureId} yet. Events can lag; retry: node spike.mjs webhook-events ${captureId}`);
      return null;
    }
    info('event not listed yet, retrying…');
    await sleep(10000);
  }
}

async function run() {
  console.log(`RightsRail sandbox spike — ${LICENSE.work}\n  scope: ${LICENSE.scope}\n`);
  await doctor();
  console.log('\n[1/3] Orders v2');
  const { order, approve } = await createOrder();
  await waitForApproval(order.id, approve);
  ok('Buyer approved');
  const { captures } = await capture(order.id);
  const cap = captures[0];

  console.log('\n[2/3] Webhooks');
  if (receiverBase()) await waitForLicense(LICENSE.id);
  else await webhookEvents(cap.id);

  console.log('\n[3/3] Payouts');
  if (LICENSE.split.every((s) => env(s.emailVar, { optional: true }))) await payout(cap.id);
  else console.log('! Skipped: set the three PAYEE_*_EMAIL values first.');

  console.log('\nDone. Multi-payee checkout is a separate test: node spike.mjs split');
  console.log(`Logs: ${LOG_DIR}`);
}

async function split() {
  console.log('Multi-payee checkout test: one order, three purchase_units, each paid to its own sandbox account.\n');
  const { order, approve } = await createOrder({ multiPayee: true });
  await waitForApproval(order.id, approve);
  ok('Buyer approved');
  await capture(order.id);
  ok('Multi-payee capture succeeded. Check each payee sandbox account for its share.');
  if (receiverBase()) await waitForLicense(LICENSE.id);
}

// ---------- cli ----------

const [cmd, arg] = process.argv.slice(2);
const commands = {
  doctor,
  run,
  split,
  'webhook-setup': webhookSetup,
  order: async () => { const { order, approve } = await createOrder(); info(`approve: ${approve}`); info(`then: node spike.mjs capture ${order.id}`); },
  capture: () => (arg ? capture(arg) : fail('Usage: node spike.mjs capture <orderId>')),
  payout: () => (arg ? payout(arg) : fail('Usage: node spike.mjs payout <captureId>')),
  'webhook-events': () => (arg ? webhookEvents(arg, { waitSeconds: 0 }) : fail('Usage: node spike.mjs webhook-events <captureId>')),
  license: () => (arg ? waitForLicense(arg, { seconds: 1 }) : fail('Usage: node spike.mjs license <licenseId>')),
};
if (!commands[cmd]) {
  console.log('Usage: node spike.mjs <doctor|run|split|webhook-setup|order|capture <orderId>|payout <captureId>|webhook-events <captureId>|license <licenseId>>');
  process.exit(cmd ? 1 : 0);
}
commands[cmd]().catch((e) => fail(e instanceof PayPalError ? e.message : e.stack || String(e)));
