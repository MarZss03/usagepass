// Explain mode: numbered registration marks on the parts of the current screen; each opens a short
// explanation of what it does and which PayPal or AI piece sits underneath. Toggle with the rail button or "?".

const NOTES = {
  works: [
    ['.rail .nav', 'Three places', 'Works hold each team’s terms. Requests are what brands asked for, already priced. Licenses exist once a brand starts paying.', 'A single page served by a zero-dependency Node server.'],
    ['.work-row', 'A work and the team behind it', 'Every work carries its own rate card, its never-licensed list, and the split between the people who made it.', 'app/lib/ratecard.mjs (sample data)'],
    ['[data-health]', 'Which AI is reading', 'Shows whether Gemini is connected. Without a key the app says so and uses a plain keyword reader instead, never pretending to be AI.', 'GET /api/health'],
  ],
  work: [
    ['.card', 'The rate card is the price list', 'The creators set every price. The AI never names a number: it only records what the brand asked for, and this card prices it.', 'priceRequest() in app/lib/ratecard.mjs'],
    ['.card .shoulder', 'Clause marks', 'Each line has a § number. Quotes and licenses cite it, so a brand can see why each line costs what it does.'],
    ['.card .row:last-child .body', 'Never licensed', 'Uses the team refuses outright. A request whose purpose is on this list (an alcohol ad, say) is refused entirely; a single excluded use (training a model) only loses that line.'],
    ['.contribs', 'Every contributor consents', 'Each person owns a part of the work, approved this version of the terms, and may set limits of their own. The split is fixed before any sale, and one PayPal checkout pays each of them straight into their own account.', 'Orders v2: one purchase unit per contributor, each with its own payee'],
    ['.contribs .st.own', 'A contributor’s own term', 'Ines allows the work to be licensed but not her voice in political ads, and not a recut of her voiceover. Requests are checked against her terms as well as the team’s.'],
    ['.work-head .btn', 'The link you send a brand', 'Brands describe their use in their own words on this page. No account, no forms of checkboxes.'],
  ],
  request: [
    ['textarea', 'Plain language in', 'Instead of a form with platform, country and duration fields, the brand writes a sentence the way they would write an email.'],
    ['.examples', 'Try the hard cases', 'The examples include a use the team refuses (AI training) and a vague one (“the spring season”) so you can see how each is handled.'],
    ['aside .ledger', 'Prices up front', 'The brand sees the rate card before asking. The quote will only ever contain these prices.'],
    ['.never', 'Never licensed', 'Refused before any order exists. These never reach PayPal.'],
  ],
  quote: [
    ['.ask', 'The brand’s own words, highlighted', 'Yellow marks the exact words each line is based on. Hover or focus a line to light up its words. The model has to quote the request word for word; anything it cannot quote is dropped and turned into a question instead of a charge.', 'Evidence is checked as a substring of the request on the server'],
    ['.ai-line', 'Who read it', 'Gemini reads the request into fields: platforms, paid or not, run length, countries, edits, print, exclusivity, excluded uses. If the model is busy it retries, then tries a backup model, then falls back to the labelled keyword reader.', 'app/lib/ai.mjs · Gemini structured output (JSON schema)'],
    ['.conflict', 'When one contributor says no', 'The AI noticed that the request runs into one contributor’s own term, quoted the words that did it, and said whose term it is. Instead of refusing, the engine prices the ways through: keep her part and drop what she does not allow, or remove her part and re-split the money among the others.', 'Gemini finds the conflict; priceRequest() computes each option from the rate card'],
    ['.notice.chosen', 'The choice is on the record', 'This quote was re-priced from the same reading after the brand picked an option. The AI was not asked again, so the numbers cannot drift.'],
    ['.terms .term:not(.refused):not(.review)', 'Priced line by line', 'Every price comes from the rate card, never from the model. Run lengths are sold in the card’s blocks and capped at its maximum.'],
    ['.terms .term-cite', 'Shoulder citation', 'The clause each price rests on, word for word from the creators’ rate card.'],
    ['.term.refused', 'Refused before checkout', 'Excluded uses never become an order line, so they can never be charged for or licensed.'],
    ['.term.review', 'Questions for the team', 'When the request is vague or off the card, the AI asks instead of guessing. Nothing is charged for these.'],
    ['.confirm', 'Before you pay', 'Exactly what is licensed and what is not, and that every contributor on this license approved these terms. Nothing on this card can change after payment.'],
    ['.pay [data-pay]', 'Pay with PayPal', 'Creates a PayPal order. In split mode it has one purchase unit per collaborator, each with its own payee, so the money never sits with the platform. Retries cannot double-charge.', 'POST /v2/checkout/orders · PayPal-Request-Id from the license id'],
    ['.proof', 'The license proof', 'Two ink plates, deliberately out of register. They line up only when PayPal confirms the payment.'],
  ],
  license: [
    ['[data-states]', 'State comes from PayPal', 'Quoted, Paid, Active, Shares paid. Each step is set by PayPal’s capture response or by a webhook, never by a button in this app.', 'CHECKOUT.ORDER.APPROVED · PAYMENT.CAPTURE.COMPLETED · PAYMENT.CAPTURE.REFUNDED / REVERSED'],
    ['.proof', 'In register means active', 'When PayPal confirms the capture, the plates snap into register and the stamp prints ACTIVE. A refund or chargeback pushes them apart and voids the license.'],
    ['[data-ledger]', 'Everyone who made it, paid', 'What each person actually received after PayPal’s fee, with the PayPal capture id of their own payment. The fee row makes the column add up to the total.', 'One capture per purchase unit · seller_receivable_breakdown · Payouts items in Payouts mode'],
    ['.record', 'An auditable record', 'The license as data: what was granted and refused, the terms version, every contributor’s approval, and every PayPal id. A full refund revokes it; a partial refund keeps it and is noted for the team.'],
    ['[data-hist]', 'What PayPal told us', 'Every event PayPal sent. PayPal checks each signature before it may change anything; duplicate deliveries are applied once.', 'POST /v1/notifications/verify-webhook-signature with the raw body'],
    ['[data-actions] .btn.danger', 'Refund and revoke', 'Refunds the buyer in PayPal. The license is voided when PayPal’s refund webhook arrives, not when the button is pressed.', 'POST /v2/payments/captures/{id}/refund'],
  ],
  requests: [
    ['.table', 'Every request, already priced', 'Each row is a brand’s sentence after the AI read it and the rate card priced it. The state column follows the license once payment starts.'],
  ],
  licenses: [
    ['.table', 'Licenses', 'A license exists from the moment a brand starts paying. Its state changes only when PayPal says so.'],
  ],
};

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let on = false;
let route = 'works';
let items = [];
let index = -1;
let layer;
let panel;
let toggle;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function collect() {
  const notes = NOTES[route] || [];
  return notes.map(([sel, title, body, tech]) => ({ el: document.querySelector(sel), title, body, tech }))
    .filter((n) => n.el && n.el.getClientRects().length);
}

function place() {
  if (!on) return;
  for (const [i, n] of items.entries()) {
    const r = n.el.getBoundingClientRect();
    const m = layer.children[i];
    // In the margin just left of the element, so the mark never covers its first words.
    m.style.transform = `translate(${Math.round(Math.max(2, r.left + scrollX - 36))}px, ${Math.round(r.top + scrollY - 2)}px)`;
  }
}

function drawMarkers() {
  items = collect();
  layer.innerHTML = items.map((n, i) => `<button type="button" class="ex-mark" data-i="${i}" style="--d:${i * 45}ms" aria-label="${i + 1}: ${esc(n.title)}"><svg viewBox="0 0 28 28" aria-hidden="true"><path d="M14 0v28M0 14h28"/></svg><span>${i + 1}</span></button>`).join('');
  [...layer.children].forEach((b) => b.addEventListener('click', () => open(Number(b.dataset.i))));
  place();
}

function open(i) {
  if (!items.length) return;
  index = (i + items.length) % items.length;
  const n = items[index];
  document.querySelectorAll('.ex-focus').forEach((el) => el.classList.remove('ex-focus'));
  [...layer.children].forEach((m, k) => m.classList.toggle('now', k === index));
  n.el.classList.add('ex-focus');
  n.el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  panel.innerHTML = `
    <p class="ex-count">${index + 1} of ${items.length}</p>
    <h2 id="ex-title">${esc(n.title)}</h2>
    <p class="ex-body">${esc(n.body)}</p>
    ${n.tech ? `<p class="ex-tech"><b>Under the hood</b>${esc(n.tech)}</p>` : ''}
    <div class="ex-nav">
      <button type="button" class="btn quiet" data-ex="prev">Previous</button>
      <button type="button" class="btn" data-ex="next">${index === items.length - 1 ? 'Start over' : 'Next'}</button>
    </div>
    <button type="button" class="ex-close" data-ex="close" aria-label="Close explanations"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
  panel.hidden = false;
  panel.classList.remove('in');
  requestAnimationFrame(() => panel.classList.add('in'));
  panel.querySelector('[data-ex="prev"]').onclick = () => open(index - 1);
  panel.querySelector('[data-ex="next"]').onclick = () => open(index + 1);
  panel.querySelector('[data-ex="close"]').onclick = () => set(false);
  panel.querySelector('[data-ex="next"]').focus({ preventScroll: true });
}

function set(next) {
  on = next;
  document.body.classList.toggle('explaining', on);
  toggle.setAttribute('aria-pressed', String(on));
  toggle.querySelector('[data-label]').textContent = on ? 'Hide explanations' : 'Explain this screen';
  if (!on) {
    layer.innerHTML = '';
    panel.hidden = true;
    index = -1;
    document.querySelectorAll('.ex-focus').forEach((el) => el.classList.remove('ex-focus'));
    return;
  }
  drawMarkers();
  open(0);
}

export function explainRoute(key) {
  route = key;
  if (on) { drawMarkers(); index = -1; if (items.length) open(0); else panel.hidden = true; }
}

export function initExplain() {
  layer = Object.assign(document.createElement('div'), { className: 'ex-layer' });
  panel = Object.assign(document.createElement('section'), { className: 'ex-panel', hidden: true });
  panel.setAttribute('aria-labelledby', 'ex-title');
  panel.setAttribute('aria-live', 'polite');
  document.body.append(layer, panel);
  toggle = document.querySelector('[data-explain]');
  toggle.addEventListener('click', () => set(!on));
  addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, [contenteditable]')) return;
    if (e.key === '?') { e.preventDefault(); set(!on); }
    if (!on) return;
    if (e.key === 'Escape') set(false);
    if (e.key === 'ArrowRight') open(index + 1);
    if (e.key === 'ArrowLeft') open(index - 1);
  });
  addEventListener('resize', place);
  new ResizeObserver(place).observe(document.body);
}
