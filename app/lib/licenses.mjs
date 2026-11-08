// Licenses: created at checkout, moved only by PayPal (capture response or verified webhook).
import { db, save, newId, hasSeen, markSeen } from './store.mjs';
import { paypal, link, env } from './paypal.mjs';
import { splitCents, money } from './ratecard.mjs';

// ---------- live updates (server-sent events) ----------

const listeners = new Map(); // licenseId -> Set(res)
export function subscribe(id, res) {
  if (!listeners.has(id)) listeners.set(id, new Set());
  listeners.get(id).add(res);
  return () => listeners.get(id)?.delete(res);
}
function publish(lic) {
  for (const res of listeners.get(lic.id) || []) res.write(`data: ${JSON.stringify(view(lic))}\n\n`);
}

// What the browser sees: no payee emails beyond what a collaborator row needs.
export function view(lic) {
  const work = db.works[lic.workId];
  return {
    ...lic,
    collaborators: lic.collaborators.map(({ email, ...c }) => c),
    captures: Object.fromEntries(Object.entries(lic.captures).map(([k, { payee, ...c }]) => [k, c])),
    work: work && { id: work.id, title: work.title, studio: work.studio, art: work.art, medium: work.medium },
  };
}

// ---------- state ----------

const FINAL = new Set(['REVOKED']);
function transition(lic, to, event, note) {
  const from = lic.status;
  if (FINAL.has(from) || from === to) { if (note) lic.history.push({ at: new Date().toISOString(), event, from, to: from, note }); return; }
  lic.status = to;
  lic.history.push({ at: new Date().toISOString(), event, from, to, ...(note ? { note } : {}) });
}
function touch(lic) { lic.updatedAt = new Date().toISOString(); save(); publish(lic); }

// ---------- checkout ----------

export async function checkout(quote, { origin }) {
  const work = db.works[quote.workId];
  if (!quote.lines.length || quote.total <= 0) throw new Error('This quote has nothing to pay for.');
  if (quote.conflicts?.length) throw new Error('A contributor’s terms conflict with this request. Choose one of the options first.');
  // Only the contributors who are party to this quote are on the license and the payment.
  const party = (quote.split || work.creators).map((p) => ({ ...p, ...work.creators.find((c) => c.id === p.id), pct: p.pct }));
  const missing = party.filter((c) => !env(c.emailEnv));
  if (missing.length) throw new Error(`Collaborator PayPal emails are not configured (${missing.map((c) => c.emailEnv).join(', ')}).`);

  const id = newId('LIC');
  const shares = splitCents(quote.total, party);
  const lic = {
    id, quoteId: quote.id, workId: work.id, brand: quote.brand, request: quote.request,
    grants: quote.lines.map((l) => ({ label: l.label, clauseId: l.clauseId, amount: l.amount })),
    notGranted: quote.refused.map((r) => ({ label: r.label, clauseId: r.clauseId })),
    total: quote.total, currency: 'USD', payMode: work.payMode,
    termsVersion: work.termsVersion || 1,
    choice: quote.choice || null,
    notParty: work.creators.filter((c) => !party.some((p) => p.id === c.id)).map((c) => ({ id: c.id, name: c.name, role: c.role, component: c.component })),
    collaborators: party.map((c, i) => ({ id: c.id, name: c.name, role: c.role, pct: c.pct, gross: shares[i], email: env(c.emailEnv), approved: c.approved || null, status: 'WAITING', amount: null })),
    status: 'AWAITING_PAYMENT', orderId: null, captures: {}, payoutBatchId: null, history: [],
    createdAt: new Date().toISOString(), updatedAt: null,
  };
  transition(lic, 'AWAITING_PAYMENT', 'checkout', `Order for $${money(quote.total)} created`);

  const experience = {
    brand_name: 'UsagePass',
    user_action: 'PAY_NOW',
    shipping_preference: 'NO_SHIPPING',
    return_url: `${origin}/paypal/return?license=${id}`,
    cancel_url: `${origin}/paypal/cancel?license=${id}`,
  };
  const description = `${work.title}: usage license ${id}`.slice(0, 127);
  const body = work.payMode === 'split'
    ? {
      // One purchase unit per collaborator, each paid straight to their own PayPal account.
      intent: 'CAPTURE',
      purchase_units: lic.collaborators.map((c, i) => ({
        reference_id: `${id}-${i + 1}`, custom_id: id,
        description: `${c.role} share (${Math.round(c.pct * 10) / 10}%) · ${description}`.slice(0, 127),
        payee: { email_address: c.email },
        amount: { currency_code: 'USD', value: money(c.gross) },
      })),
      payment_source: { paypal: { experience_context: experience } },
    }
    : {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: id, custom_id: id, invoice_id: id, description,
        amount: { currency_code: 'USD', value: money(quote.total), breakdown: { item_total: { currency_code: 'USD', value: money(quote.total) } } },
        items: quote.lines.filter((l) => l.amount > 0).map((l) => ({
          name: `${l.label} (§${l.clauseId})`.slice(0, 127), quantity: '1', category: 'DIGITAL_GOODS',
          unit_amount: { currency_code: 'USD', value: money(l.amount) },
        })),
      }],
      payment_source: { paypal: { experience_context: experience } },
    };
  const { data } = await paypal('order-create', 'POST', '/v2/checkout/orders', body, { requestId: `order-${id}` });
  lic.orderId = data.id;
  db.licenses[id] = lic;
  touch(lic);
  return { license: lic, approveUrl: link(data, 'payer-action', 'approve') };
}

// Buyer came back from PayPal: capture now. The webhook will confirm the same capture independently.
export async function captureOnReturn(lic) {
  if (!lic.orderId || ['ACTIVE', 'PARTIALLY_PAID', 'REVOKED'].includes(lic.status)) return lic;
  const { data } = await paypal('order-capture', 'POST', `/v2/checkout/orders/${lic.orderId}/capture`, {}, { requestId: `capture-${lic.id}`, allowFail: true });
  if (data.name === 'ORDER_ALREADY_CAPTURED' || data.details?.some((d) => d.issue === 'ORDER_ALREADY_CAPTURED')) return lic;
  if (data.details?.some((d) => d.issue === 'ORDER_NOT_APPROVED')) return lic;
  if (data.name) throw new Error(`PayPal could not capture the payment: ${data.details?.[0]?.description || data.message || data.name}`);
  const caps = (data.purchase_units || []).flatMap((pu) => (pu.payments?.captures || []).map((c) => ({ ...c, payee: pu.payee })));
  await serial(async () => {
    for (const c of caps) recordCapture(lic, c, 'capture response');
    settle(lic, 'capture response');
    touch(lic);
  });
  await maybePayout(lic);
  return lic;
}

export function cancelled(lic) {
  if (lic.status === 'AWAITING_PAYMENT') { transition(lic, 'AWAITING_PAYMENT', 'cancel', 'Buyer left PayPal without paying'); touch(lic); }
  return lic;
}

function recordCapture(lic, c, source) {
  const prev = lic.captures[c.id];
  lic.captures[c.id] = {
    status: c.status, amount: c.amount?.value, payee: c.payee?.email_address || prev?.payee || null,
    fee: c.seller_receivable_breakdown?.paypal_fee?.value || prev?.fee || null,
    net: c.seller_receivable_breakdown?.net_amount?.value || prev?.net || null,
    reason: c.status_details?.reason || null, source,
  };
  if (lic.payMode === 'split') {
    const col = lic.collaborators.find((x) => x.email && x.email === lic.captures[c.id].payee);
    if (col) { col.status = c.status === 'COMPLETED' ? 'PAID' : c.status; col.amount = lic.captures[c.id].net || lic.captures[c.id].amount; col.captureId = c.id; }
  }
}

function settle(lic, event) {
  const caps = Object.values(lic.captures);
  const expected = lic.payMode === 'split' ? lic.collaborators.length : 1;
  const done = caps.filter((c) => c.status === 'COMPLETED').length;
  if (caps.some((c) => c.status === 'DECLINED' || c.status === 'FAILED')) return transition(lic, 'DENIED', event);
  if (done >= expected) return transition(lic, 'ACTIVE', event, `${done}/${expected} captured`);
  if (caps.some((c) => c.status === 'PENDING')) return transition(lic, 'PAYMENT_HELD', event, caps.find((c) => c.reason)?.reason);
  if (done > 0) return transition(lic, 'PARTIALLY_PAID', event, `${done}/${expected} captured`);
}

// Payouts mode: once the single capture is in, split its net 70/20/10 (or the work's split) with Payouts.
async function maybePayout(lic) {
  if (lic.payMode !== 'payouts' || lic.status !== 'ACTIVE' || lic.payoutBatchId) return;
  const cap = Object.entries(lic.captures).find(([, c]) => c.status === 'COMPLETED');
  if (!cap) return;
  lic.payoutBatchId = 'creating';
  const net = Math.round(Number(cap[1].net || cap[1].amount) * 100);
  const shares = splitCents(net, lic.collaborators);
  try {
    const { data } = await paypal('payout-create', 'POST', '/v1/payments/payouts', {
      sender_batch_header: { sender_batch_id: `${lic.id}-payout`, email_subject: 'UsagePass: your share of a license sale', email_message: `${lic.brand} licensed your work. This is your agreed share of license ${lic.id}.` },
      items: lic.collaborators.map((c, i) => ({
        recipient_type: 'EMAIL', receiver: c.email, amount: { value: money(shares[i]), currency: 'USD' },
        note: `${c.role} share (${Math.round(c.pct * 10) / 10}%) of ${lic.id}`, sender_item_id: `${lic.id}-${i + 1}`,
      })),
    }, { requestId: false });
    lic.payoutBatchId = data.batch_header?.payout_batch_id;
    lic.collaborators.forEach((c, i) => { c.status = 'SENDING'; c.amount = money(shares[i]); });
    transition(lic, 'ACTIVE', 'payout-create', `Payout batch ${lic.payoutBatchId} sent: net $${money(net)} split`);
  } catch (e) {
    lic.payoutBatchId = null;
    transition(lic, 'ACTIVE', 'payout-create', `Payout failed: ${e.message}`);
  }
  touch(lic);
}

// ---------- webhooks ----------

let queue = Promise.resolve();
const serial = (fn) => (queue = queue.then(fn, fn));

async function captureFor(resource) {
  const up = resource.links?.find((l) => l.rel === 'up')?.href;
  const id = up?.match(/captures\/([^/?]+)/)?.[1];
  if (!id) return null;
  const { data } = await paypal('capture-get', 'GET', `/v2/payments/captures/${id}`, null, { allowFail: true });
  return data?.id ? data : null;
}

// Applies one verified event. Returns a short description for the log.
export function applyEvent(event) {
  return serial(async () => {
    if (hasSeen(event.id)) return 'duplicate';
    const r = event.resource || {};
    let lic = null;
    let out = 'ignored';
    switch (event.event_type) {
      case 'CHECKOUT.ORDER.APPROVED': {
        lic = db.licenses[r.purchase_units?.find((pu) => pu.custom_id)?.custom_id];
        if (lic && lic.status === 'AWAITING_PAYMENT') transition(lic, 'APPROVED', event.event_type, 'Buyer approved in PayPal');
        break;
      }
      case 'PAYMENT.CAPTURE.COMPLETED':
      case 'PAYMENT.CAPTURE.PENDING':
      case 'PAYMENT.CAPTURE.DENIED': {
        lic = db.licenses[r.custom_id];
        if (lic) { recordCapture(lic, r, 'webhook'); settle(lic, event.event_type); }
        break;
      }
      case 'PAYMENT.CAPTURE.REFUNDED':
      case 'PAYMENT.CAPTURE.REVERSED': {
        // The refunded capture says whether it was refunded in full or in part.
        const cap = await captureFor(r);
        const id = r.custom_id || cap?.custom_id;
        lic = db.licenses[id];
        if (!lic) break;
        const what = event.event_type.endsWith('REVERSED') ? 'Chargeback' : 'Refund';
        if (cap?.status === 'PARTIALLY_REFUNDED') {
          // A partial refund changes the money, not the grant: the license stays and the change is on record.
          lic.amendments = [...(lic.amendments || []), { at: new Date().toISOString(), event: event.event_type, captureId: cap.id, amount: r.amount?.value }];
          transition(lic, lic.status, event.event_type, `Partial ${what.toLowerCase()} of ${r.amount?.value} on capture ${cap.id}; license unchanged, flagged for the team`);
        } else {
          transition(lic, 'REVOKED', event.event_type, `${what} of ${r.amount?.value}${cap ? ` on capture ${cap.id}` : ''}`);
        }
        break;
      }
      case 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED':
      case 'PAYMENT.PAYOUTS-ITEM.FAILED': {
        const sid = r.payout_item?.sender_item_id || '';
        lic = db.licenses[sid.replace(/-\d+$/, '')];
        const col = lic?.collaborators[Number(sid.match(/-(\d+)$/)?.[1]) - 1];
        if (col) { col.status = r.transaction_status === 'SUCCESS' ? 'PAID' : r.transaction_status; col.amount = r.payout_item?.amount?.value || col.amount; col.payoutItemId = r.payout_item_id; }
        if (lic) lic.history.push({ at: new Date().toISOString(), event: event.event_type, from: lic.status, to: lic.status, note: `${col?.name}: ${r.transaction_status}` });
        break;
      }
      default:
    }
    markSeen(event.id);
    if (lic) { lic.lastEvent = { type: event.event_type, id: event.id, at: new Date().toISOString() }; touch(lic); out = `${lic.id} → ${lic.status}`; }
    else save();
    if (lic) maybePayout(lic);
    return out;
  });
}
