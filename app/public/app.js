// UsagePass front end. No framework: a hash router, string templates, and one live stream per license.
import { initExplain, explainRoute } from './explain.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const main = $('#main');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = (cents) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usdStr = (v) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { data, status: res.status });
  return data;
}

function toast(msg) {
  const t = $('.toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 4200);
}

// ---------- icons (one stroke family) ----------

const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  check: icon('<path d="M4.5 12.5l5 5 10-11"/>'),
  arrow: icon('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  out: icon('<path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5"/>'),
  x: icon('<path d="M6 6l12 12M18 6L6 18"/>'),
};
const REG = `<svg class="regmark" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M11 0v22M0 11h22"/></svg>`;

// ---------- sample artwork (authored SVG, two-ink overprint) ----------

const ART = {
  spring: `<svg class="art" viewBox="0 0 400 500" role="img" aria-label="Sample artwork: Spring launch poster, a pink sun over blue hills">
    <rect width="400" height="500" fill="#fbfaf5"/>
    <g style="mix-blend-mode:multiply">
      <circle cx="232" cy="190" r="118" fill="#ff48b0"/>
      <g fill="#ffe800"><rect x="60" y="80" width="16" height="200" rx="8" transform="rotate(-24 68 180)"/><rect x="330" y="60" width="14" height="160" rx="7" transform="rotate(28 337 140)"/></g>
      <path d="M-10 360 C 70 280 140 300 200 340 S 330 300 410 330 V 510 H -10Z" fill="#0078bf"/>
      <path d="M-10 410 C 90 350 190 380 250 400 S 360 380 410 395 V 510 H -10Z" fill="#0078bf" opacity=".55"/>
      <circle cx="120" cy="300" r="46" fill="#ff48b0" opacity=".7"/>
    </g>
    <text x="28" y="470" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="70" fill="#fbfaf5" letter-spacing="-2">SPRING</text>
    <text x="30" y="44" font-family="Atkinson Hyperlegible, sans-serif" font-weight="700" font-size="15" fill="#0078bf" letter-spacing="2">STUDIO PALOMA · 2026</text>
  </svg>`,
  night: `<svg class="art" viewBox="0 0 400 500" role="img" aria-label="Sample artwork: Night market loop, yellow lanterns on a blue night">
    <rect width="400" height="500" fill="#0078bf"/>
    <g style="mix-blend-mode:multiply"><path d="M0 120 Q 200 220 400 110" stroke="#ff48b0" stroke-width="5" fill="none"/><path d="M0 250 Q 200 340 400 240" stroke="#ff48b0" stroke-width="5" fill="none"/></g>
    <g fill="#ffe800">${[40, 110, 180, 250, 320].map((x, i) => `<ellipse cx="${x + 20}" cy="${150 + (i % 2) * 18 + (i === 2 ? 22 : 0)}" rx="22" ry="28"/>`).join('')}${[60, 150, 240, 330].map((x, i) => `<ellipse cx="${x}" cy="${285 + (i % 2) * 14}" rx="18" ry="23"/>`).join('')}</g>
    <rect x="0" y="380" width="400" height="120" fill="#1d1d1b" opacity=".85"/>
    <text x="26" y="462" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="58" fill="#ffe800" letter-spacing="-2">NIGHT MKT</text>
  </svg>`,
};
const art = (key) => ART[key] || ART.spring;

// ---------- state vocabulary (one ordered line, same everywhere) ----------

const LABEL = {
  QUOTED: 'Quoted', AWAITING_PAYMENT: 'Awaiting payment', APPROVED: 'Approved in PayPal', PARTIALLY_PAID: 'Partly captured',
  PAYMENT_HELD: 'Held by PayPal', ACTIVE: 'Active', DENIED: 'Payment declined', REVOKED: 'Revoked',
};
function stateLine(lic) {
  const s = lic?.status || 'QUOTED';
  if (s === 'REVOKED') return `<ol class="states" aria-label="License state"><li class="done">${I.check}Quoted</li><li class="done">${I.check}Paid</li><li class="revoked">${I.x}Revoked</li></ol>`;
  const sharesPaid = lic?.collaborators?.every((c) => c.status === 'PAID');
  const steps = [
    ['Quoted', 'done'],
    [['AWAITING_PAYMENT', 'QUOTED'].includes(s) ? 'Awaiting payment' : ['APPROVED', 'PARTIALLY_PAID', 'PAYMENT_HELD', 'DENIED'].includes(s) ? LABEL[s] : 'Paid',
      s === 'QUOTED' ? 'todo' : s === 'ACTIVE' ? 'done' : 'now'],
    ['Active', s === 'ACTIVE' ? 'done' : 'todo'],
    ['Shares paid', sharesPaid ? 'done' : s === 'ACTIVE' ? 'now' : 'todo'],
  ];
  if (s === 'QUOTED') steps[0][1] = 'now';
  return `<ol class="states" aria-label="License state">${steps.map(([t, c]) => `<li class="${c}">${c === 'done' ? I.check : c === 'now' ? '<span class="dot live" aria-hidden="true"></span>' : ''}${t}${c === 'now' ? '<span class="sr"> (current)</span>' : ''}</li>`).join('')}</ol>`;
}

// ---------- the license proof ----------

function proofHTML({ id, title, brand, grants, notGranted = [], total, status }) {
  const stamp = { ACTIVE: 'ACTIVE', REVOKED: 'VOID', DENIED: 'DECLINED', REFUSED: 'REFUSED', APPROVED: 'PAYING', PARTIALLY_PAID: 'PAYING', PAYMENT_HELD: 'HELD' }[status] || 'UNPAID';
  return `<div class="proof-wrap">
    <div class="proof" data-reg="${regFor(status)}" aria-label="License proof, ${esc(LABEL[status] || 'quoted')}">
      <div class="plate blue">${REG.replace('regmark', 'regmark tl')}${REG.replace('regmark', 'regmark br')}
        <p class="lic-id">${esc(id)}</p>
        <p class="lic-title">${esc(title)}</p>
        <p class="lic-to">Licensed to <b>${esc(brand)}</b></p>
        <ul class="grants">${grants.map((g) => `<li><span>${esc(g.label)}</span><span class="money">${usd(g.amount)}</span></li>`).join('')}${notGranted.map((g) => `<li class="no"><span>${esc(g.label)}</span><span>not granted</span></li>`).join('')}</ul>
        <div class="stamp-zone" aria-hidden="true"></div>
        <p class="p-total"><span>Total</span><span>${usd(total)}</span></p>
      </div>
      <div class="plate pink">${REG.replace('regmark', 'regmark tl')}${REG.replace('regmark', 'regmark br')}<div class="halftone"></div><p class="stamp" data-stamp>${stamp}</p></div>
    </div>
    <p class="proof-cap" data-cap>${capFor(status)}</p>
  </div>`;
}
const regFor = (s) => (s === 'ACTIVE' ? 'in' : s === 'REVOKED' ? 'drift' : 'off');
const capFor = (s) => ({
  ACTIVE: 'In register: PayPal confirmed the payment, so the license is active.',
  REVOKED: 'Out of register for good: the payment was refunded or reversed.',
  DENIED: 'PayPal declined the payment. Nothing is licensed.',
  REFUSED: 'Never goes to press: the request is for a use the team never licenses.',
}[s] || 'The plates come into register when PayPal confirms the payment.');

// Brings an on-screen proof to a new state; the move into register is the one authored moment.
function setProof(root, status) {
  const proof = $('.proof', root);
  if (!proof) return;
  const to = regFor(status);
  const stampEl = $('[data-stamp]', proof);
  const word = { ACTIVE: 'ACTIVE', REVOKED: 'VOID', DENIED: 'DECLINED', APPROVED: 'PAYING', PARTIALLY_PAID: 'PAYING', PAYMENT_HELD: 'HELD' }[status] || 'UNPAID';
  if (proof.dataset.reg !== to) proof.dataset.reg = to;
  if (stampEl.textContent !== word) {
    stampEl.classList.add('enter');
    stampEl.textContent = word;
    requestAnimationFrame(() => requestAnimationFrame(() => stampEl.classList.remove('enter')));
  }
  $('[data-cap]', root).textContent = capFor(status);
  proof.setAttribute('aria-label', `License proof, ${LABEL[status] || 'quoted'}`);
}

// ---------- ledger: who gets paid ----------

function shares(total, creators) {
  const parts = creators.map((c) => Math.floor((total * c.pct) / 100));
  parts[0] += total - parts.reduce((a, b) => a + b, 0);
  return parts;
}
// PayPal's fee across all captures of a license, in cents (so the ledger visibly sums to the total).
const feesOf = (lic) => Math.round(Object.values(lic.captures || {}).reduce((s, c) => s + Number(c.fee || 0), 0) * 100);

function ledgerHTML(collabs, { payMode, total, live, fees = 0 }) {
  const est = shares(total, collabs);
  const rows = collabs.map((c, i) => {
    const paid = c.status === 'PAID';
    const sending = c.status === 'SENDING';
    const amount = paid && c.amount ? usdStr(c.amount) : payMode === 'split' ? usd(est[i]) : `${c.pct}%`;
    const st = !live ? (payMode === 'split' ? 'Paid directly at checkout' : 'Paid from the net after PayPal fees')
      : paid ? `${I.check}Received ${payMode === 'split' ? 'directly from the buyer, after PayPal fees' : 'by PayPal Payouts'}`
        : sending ? '<span class="dot live"></span>Payout sent, waiting for PayPal'
          : c.status && c.status !== 'WAITING' ? esc(c.status.toLowerCase()) : '<span class="dot"></span>Waits for the payment';
    return `<li data-collab="${esc(c.id)}"><span class="who"><b>${esc(c.name)}</b> <span>· ${esc(c.role)} · ${c.pct}%</span></span><span class="money">${amount}</span><span class="st ${paid ? 'paid' : ''}">${st}</span></li>`;
  });
  if (live && fees > 0) rows.push(`<li><span class="who"><b>PayPal fees</b> <span>· kept by PayPal</span></span><span class="money">${usd(fees)}</span></li>`);
  return `<div class="ledger-wrap"><h2>Who gets paid</h2><ul class="ledger" style="margin-top:8px">${rows.join('')}</ul></div>`;
}

// The total ticks up once the last line has landed, like a register adding the lines above.
function countUp(el, cents, delay = 0) {
  if (!el) return;
  el.textContent = usd(0);
  setTimeout(() => {
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 650);
      el.textContent = usd(Math.round(cents * (1 - Math.pow(1 - k, 4))));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, delay);
}

// ---------- evidence highlighting ----------

function markEvidence(text, items) {
  // items: [{key, evidence}] → wrap the first unclaimed occurrence of each phrase.
  const spans = [];
  const lower = text.toLowerCase();
  for (const it of items) {
    if (!it.evidence) continue;
    let from = 0;
    let at;
    while ((at = lower.indexOf(it.evidence.toLowerCase(), from)) >= 0) {
      const end = at + it.evidence.length;
      if (!spans.some((s) => at < s.end && end > s.start)) { spans.push({ start: at, end, key: it.key }); break; }
      from = at + 1;
    }
  }
  spans.sort((a, b) => a.start - b.start);
  let out = '';
  let i = 0;
  for (const s of spans) { out += esc(text.slice(i, s.start)) + `<mark data-ev="${esc(s.key)}">${esc(text.slice(s.start, s.end))}</mark>`; i = s.end; }
  return out + esc(text.slice(i));
}
function wireEvidence(root) {
  for (const t of $$('[data-ev]', root).filter((el) => !el.matches('mark'))) {
    const on = () => $$(`mark[data-ev="${CSS.escape(t.dataset.ev)}"]`, root).forEach((m) => m.classList.add('hot'));
    const off = () => $$('mark.hot', root).forEach((m) => m.classList.remove('hot'));
    t.addEventListener('mouseenter', on); t.addEventListener('mouseleave', off);
    t.addEventListener('focusin', on); t.addEventListener('focusout', off);
  }
}

// ---------- views ----------

async function viewWorks() {
  const works = await api('/api/works');
  main.innerHTML = `<section class="page">
    <h1>Works</h1>
    <p class="lede">Each work has its own rate card, its never-licensed list, and the split between the people who made it. Brands license from the request page; PayPal payment makes the license active.</p>
    <div class="works">${works.map((w) => {
      const base = w.clauses.find((c) => c.kind === 'base');
      return `<a class="work-row" href="#/works/${w.id}">${art(w.art)}<div><h3>${esc(w.title)}</h3><p>${esc(w.studio)} · ${esc(w.medium)}</p><p class="small">${w.creators.map((c) => `${esc(c.name)} ${c.pct}%`).join(' · ')}</p></div><p class="from"><span class="money">${usd(base.price)}</span><small>base license</small></p></a>`;
    }).join('')}</div>
  </section>`;
}

async function viewWork(id) {
  const w = await api(`/api/works/${id}`);
  const never = w.clauses.find((c) => c.kind === 'excluded');
  const priceOf = (c) => c.price != null ? usd(c.price) + (c.blockDays ? ` / ${c.blockDays} days` : c.kind === 'territory' ? ' each' : '') : c.prices ? `${usd(c.prices.text)} · recut ${usd(c.prices.recut)}` : '';
  main.innerHTML = `<section class="page">
    <p class="crumb"><a href="#/works">Works</a><span aria-hidden="true">/</span><span>${esc(w.title)}</span></p>
    <div class="work-head">
      <figure>${art(w.art)}<figcaption class="art-note">Sample artwork</figcaption></figure>
      <div>
        <h1>${esc(w.title)}</h1>
        <p class="lede">${esc(w.medium)}, by ${esc(w.studio)}.</p>
        <p class="facts"><span><b>Home territory</b> ${w.home.join(', ')}</span><span><b>Collaborators paid</b> ${w.payMode === 'split' ? 'directly at checkout' : 'by PayPal Payouts after capture'}</span></p>
        <div class="actions"><a class="btn" href="#/request/${w.id}">Open the brand request page ${I.arrow}</a><span class="small muted">This is the page you send to a brand.</span></div>
      </div>
    </div>
    <div class="card" role="list" aria-label="Rate card">
      <h2 style="padding:10px 0 8px">Rate card</h2><h2 style="padding:10px 0 8px;color:var(--ink-soft)">Clause</h2>
      ${w.clauses.filter((c) => c.kind !== 'excluded').map((c) => `<div class="row" role="listitem"><div class="body"><div><b>${esc(c.title)}</b><p>${esc(c.text)}</p></div><span class="money">${priceOf(c)}</span></div><div class="shoulder"><span class="mark">§${c.id}</span></div></div>`).join('')}
      <div class="row" role="listitem"><div class="body"><div><b>${esc(never.title)}</b><p>${never.uses.map(esc).join('; ')}. The AI refuses these before any order exists.</p></div></div><div class="shoulder"><span class="mark">§${never.id}</span></div></div>
    </div>
    <div style="max-width:620px;margin-top:34px">${ledgerHTML(w.creators, { payMode: w.payMode, total: 0, live: false })}</div>
  </section>`;
}

const EXAMPLES = [
  'We want to run it as paid ads on Instagram and TikTok in Canada and the US for three months, edit the caption, and use it to train our image model.',
  'Boost it on Facebook and YouTube in Canada for 30 days, exactly as it is.',
  'Put it on bus shelters in Toronto and on our website for the spring season, with our logo added.',
];

async function viewRequest(id) {
  const w = await api(`/api/works/${id}`);
  const never = w.clauses.find((c) => c.kind === 'excluded');
  const summary = w.clauses.filter((c) => c.price != null || c.prices);
  main.innerHTML = `<div class="page-split">
  <section class="col">
    <p class="crumb"><a href="#/works/${w.id}">${esc(w.title)}</a><span aria-hidden="true">/</span><span>Request a license</span></p>
    <h1>License “${esc(w.title)}”</h1>
    <p class="lede">Say how you want to use it, in your own words. You get an itemised price from ${esc(w.studio)}’s rate card, with the clause behind every line, and you can pay right away.</p>
    <form class="ask-form" novalidate style="margin-top:26px">
      <div class="field"><label for="brand">Your brand</label><input type="text" id="brand" name="brand" autocomplete="organization" placeholder="Northfield Coffee" value="Northfield Coffee"></div>
      <div class="field"><label for="req">How do you want to use it?</label>
        <textarea id="req" name="request" required maxlength="1200" placeholder="Where it will run, for how long, which countries, and any changes you want to make."></textarea>
        <p class="hint">Try one:</p>
        <div class="examples">${EXAMPLES.map((e, i) => `<button type="button" class="chip" data-ex="${i}">${esc(e)}</button>`).join('')}</div>
      </div>
      <div class="form-row"><button class="btn" type="submit">Get my quote ${I.arrow}</button><p class="error" data-err role="alert"></p></div>
    </form>
    <div class="reading" data-reading hidden><p>Reading your request against the rate card…</p><div class="inkbar"><span></span></div></div>
  </section>
  <aside aria-label="About this work">
    <figure>${art(w.art)}<figcaption class="art-note">Sample artwork · ${esc(w.medium)}</figcaption></figure>
    <div><h2>Rate card</h2><ul class="ledger" style="margin-top:8px">${summary.map((c) => `<li><span class="who"><b>${esc(c.title)}</b></span><span class="money">${c.price != null ? usd(c.price) + (c.blockDays ? ` / ${c.blockDays} days` : c.kind === 'territory' ? ' each' : '') : `text free · recut ${usd(c.prices.recut)}`}</span></li>`).join('')}</ul></div>
    <div><h2>Never licensed</h2><ul class="never">${never.uses.map((u) => `<li><span>${esc(u)}</span></li>`).join('')}</ul></div>
  </aside>
  </div>`;
  const form = $('form', main);
  $$('[data-ex]', main).forEach((b) => b.addEventListener('click', () => { form.request.value = EXAMPLES[b.dataset.ex]; form.request.focus(); }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('[data-err]', main);
    err.textContent = '';
    if (form.request.value.trim().length < 8) { err.textContent = 'Describe how you want to use the work in a sentence or two.'; form.request.focus(); return; }
    const btn = $('button[type="submit"]', form);
    btn.disabled = true;
    btn.innerHTML = '<span class="spin" aria-hidden="true"></span> Reading…';
    const reading = $('[data-reading]', main);
    reading.innerHTML = `<p>Reading your words against ${esc(w.studio)}’s rate card…</p><p class="sweep" aria-hidden="true">${esc(form.request.value.trim())}</p>`;
    reading.hidden = false;
    reading.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    try {
      const q = await api(`/api/works/${w.id}/quotes`, { method: 'POST', body: { brand: form.brand.value, request: form.request.value } });
      sessionStorage.setItem('fresh', q.id);
      location.hash = `#/quotes/${q.id}`;
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      btn.innerHTML = `Get my quote ${I.arrow}`;
      $('[data-reading]', main).hidden = true;
    }
  });
}

function termsHTML(q) {
  let i = 0;
  const line = (l) => `<div class="term" data-ev="${esc(l.key)}" style="--i:${i}" tabindex="0"><strong>${esc(l.label)}${l.evidence ? `<span class="why">You asked: “${esc(l.evidence)}”</span>` : ''}</strong><span class="money">${usd(l.amount)}</span></div><div class="term-cite" style="--i:${i++}"><span class="mark">§${esc(l.clauseId)} ${esc(l.clauseTitle)}</span><br>${esc(l.clauseText)}</div>`;
  const refused = (l) => `<div class="term refused" data-ev="${esc(l.key)}" style="--i:${i}" tabindex="0"><strong><span class="label">${esc(l.label)}</span><span class="why">${esc(l.reason)}${l.evidence ? ` You asked: “${esc(l.evidence)}”` : ''}</span></strong><span class="flag">Not offered</span></div><div class="term-cite" style="--i:${i++}">${l.clauseId ? `<span class="mark">§${esc(l.clauseId)} ${esc(l.clauseTitle)}</span><br>${esc(l.clauseText)}` : ''}</div>`;
  const review = (l) => `<div class="term review" data-ev="${esc(l.key)}" style="--i:${i}" tabindex="0"><strong>${esc(l.label)}</strong><span class="flag">Team will confirm</span></div><div class="term-cite" style="--i:${i++}">${l.clauseId ? `<span class="mark">§${esc(l.clauseId)} ${esc(l.clauseTitle)}</span>` : 'Not on the rate card'}</div>`;
  return `<div class="terms">
    <h2>${q.blocked ? 'What you asked for' : 'What you can do'}</h2><h2 class="shoulder-h">From the rate card</h2>
    ${q.lines.map(line).join('')}
    ${q.refused.map(refused).join('')}
    ${q.review.map(review).join('')}
    <div class="total" style="--i:${i}"><span>${q.blocked ? 'Nothing to pay' : 'Total'}</span><span>${usd(q.total)}</span></div><div></div>
  </div>`;
}

function aiLine(q) {
  if (q.ai.source === 'gemini') return `<p class="ai-line"><span class="tag">AI</span>Read by ${esc(q.ai.model)} in ${(q.ai.ms / 1000).toFixed(1)}s. Prices come from the rate card, not the model. Highlighted words are what each line is based on.</p>`;
  return `<p class="ai-line"><span class="tag offline">Offline reader</span>No AI key is set, so simple keyword rules read this request. Prices still come from the rate card.</p>`;
}

async function viewQuote(id, params) {
  const q = await api(`/api/quotes/${id}`);
  const w = await api(`/api/works/${q.workId}`);
  let lic = q.licenseId ? await api(`/api/licenses/${q.licenseId}`).catch(() => null) : null;
  if (lic && lic.status !== 'AWAITING_PAYMENT') { location.replace(`#/licenses/${lic.id}`); return; }
  const fresh = sessionStorage.getItem('fresh') === q.id;
  sessionStorage.removeItem('fresh');
  const ev = [...q.lines, ...q.refused, ...q.review].map((l) => ({ key: l.key, evidence: l.evidence }));
  main.innerHTML = `<div class="page-split">
    <section class="col ${fresh && !reduced ? 'fresh' : ''}">
      <p class="crumb"><a href="#/requests">Requests</a><span aria-hidden="true">/</span><span>${esc(q.brand)}</span></p>
      <h1>${esc(w.title)}</h1>
      <blockquote class="ask"><span class="who">${esc(q.brand)} asked</span>${markEvidence(q.request, ev)}</blockquote>
      ${aiLine(q)}
      ${params.get('cancelled') ? '<p class="notice">You left PayPal before paying. Nothing was charged; the quote is still here.</p>' : ''}
      ${q.blocked ? `<p class="notice"><b>Not available.</b> ${esc(q.blocked)} No order can be created.</p>` : ''}
      ${termsHTML(q)}
      <div class="pay">${q.total > 0 ? `<button class="btn" data-pay>Pay ${usd(q.total)} with PayPal ${I.out}</button>` : ''}<p class="small muted">PayPal sandbox. ${w.payMode === 'split' ? 'One checkout pays each collaborator directly.' : 'Collaborators are paid by PayPal Payouts once the payment clears.'} Not legal advice; the license grants only the lines above.</p></div>
      <p class="error" data-err role="alert"></p>
    </section>
    <aside aria-label="License preview">
      ${stateLine(null)}
      ${proofHTML({ id: q.id, title: w.title, brand: q.brand, grants: q.lines, notGranted: q.refused, total: q.total, status: q.blocked ? 'REFUSED' : 'QUOTED' })}
      ${ledgerHTML(w.creators, { payMode: w.payMode, total: q.total, live: false })}
    </aside>
  </div>
  ${q.total > 0 ? `<div class="paybar" aria-hidden="true"><span class="money">${usd(q.total)}</span><button class="btn" data-pay tabindex="-1">Pay with PayPal ${I.out}</button></div>` : ''}`;
  const inflow = $('.pay [data-pay]', main);
  const bar = $('.paybar', main);
  if (inflow && bar && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => bar.classList.toggle('away', e.isIntersecting)).observe(inflow);
  }
  wireEvidence(main);
  if (fresh && !reduced && q.total > 0) countUp($('.terms .total span:last-child', main), q.total, 120 + (q.lines.length + q.refused.length + q.review.length) * 90);
  $$('[data-pay]', main).forEach((b) => b.addEventListener('click', async (e) => {
    const btn = $('.pay [data-pay]', main);
    e.currentTarget.disabled = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spin" aria-hidden="true"></span> Opening PayPal…';
    try {
      const { approveUrl } = await api(`/api/quotes/${q.id}/checkout`, { method: 'POST' });
      location.href = approveUrl;
    } catch (ex) {
      $('[data-err]', main).textContent = `${ex.message} Nothing was charged; try again.`;
      $$('[data-pay]', main).forEach((x) => { x.disabled = false; });
      btn.innerHTML = `Pay ${usd(q.total)} with PayPal ${I.out}`;
      btn.scrollIntoView({ block: 'center' });
    }
  }));
}

function historyHTML(lic) {
  const fmt = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const say = (h) => {
    if (h.event === 'checkout') return `PayPal order created. ${esc(h.note || '')}`;
    if (h.event === 'cancel') return esc(h.note);
    if (h.event === 'capture response') return `Payment captured. ${h.to === 'ACTIVE' ? 'License active.' : ''}`;
    if (h.event === 'payout-create') return esc(h.note);
    return `PayPal sent <code>${esc(h.event)}</code>, signature verified.${h.note ? ` ${esc(h.note)}.` : ''}${h.to !== h.from ? ` ${esc(LABEL[h.to] || h.to)}.` : ''}`;
  };
  return `<div><h2>What PayPal told us</h2><ol class="history" style="margin-top:8px" data-history>${[...lic.history].reverse().map((h) => `<li><time datetime="${esc(h.at)}">${fmt(h.at)}</time><span>${say(h)}</span></li>`).join('')}</ol></div>`;
}

let stream = null;
async function viewLicense(id, params) {
  let lic = await api(`/api/licenses/${id}`);
  const work = await api(`/api/works/${lic.workId}`).catch(() => null);
  const clause = (cid) => work?.clauses.find((c) => c.id === cid);
  const cite = (cid) => { const c = clause(cid); return `<span class="mark">§${esc(cid)}${c ? ` ${esc(c.title)}` : ''}</span>${c ? `<br>${esc(c.text)}` : ''}`; };
  const activatedAt = lic.history.find((h) => h.to === 'ACTIVE' && h.from !== 'ACTIVE')?.at;
  // Arriving straight from PayPal: show the plates landing even if the capture beat the page load.
  const replay = lic.status === 'ACTIVE' && activatedAt && Date.now() - new Date(activatedAt).getTime() < 90000 && !reduced;
  main.innerHTML = `<div class="page-split">
    <section class="col">
      <p class="crumb"><a href="#/licenses">Licenses</a><span aria-hidden="true">/</span><span>${esc(lic.id)}</span></p>
      <h1>${esc(lic.work?.title || 'License')}</h1>
      <blockquote class="ask"><span class="who">${esc(lic.brand)} asked</span>${esc(lic.request)}</blockquote>
      ${params.get('error') ? `<p class="notice">${esc(params.get('error'))}</p>` : ''}
      ${params.get('stale') ? '<p class="notice">That PayPal tab belonged to an older checkout. This license is unchanged.</p>' : ''}
      <div class="terms">
        <h2>Granted</h2><h2 class="shoulder-h">Clause</h2>
        ${lic.grants.map((g) => `<div class="term"><strong>${esc(g.label)}</strong><span class="money">${usd(g.amount)}</span></div><div class="term-cite">${cite(g.clauseId)}</div>`).join('')}
        ${lic.notGranted.map((g) => `<div class="term refused"><strong><span class="label">${esc(g.label)}</span><span class="why">Not granted</span></strong><span></span></div><div class="term-cite">${cite(g.clauseId)}</div>`).join('')}
        <div class="total"><span>Paid</span><span>${usd(lic.total)}</span></div><div></div>
      </div>
      <div class="pay" data-actions></div>
      <div style="margin-top:34px;max-width:760px" data-hist>${historyHTML(lic)}</div>
    </section>
    <aside aria-label="License">
      <div data-states>${stateLine(lic)}</div>
      ${proofHTML({ id: lic.id, title: lic.work?.title, brand: lic.brand, grants: lic.grants, notGranted: lic.notGranted, total: lic.total, status: replay ? 'APPROVED' : lic.status })}
      <div data-ledger>${ledgerHTML(lic.collaborators, { payMode: lic.payMode, total: lic.total, live: true, fees: feesOf(lic) })}</div>
    </aside>
  </div>`;
  const render = (next, prev) => {
    $('[data-states]', main).innerHTML = stateLine(next);
    $('[data-ledger]', main).innerHTML = ledgerHTML(next.collaborators, { payMode: next.payMode, total: next.total, live: true, fees: feesOf(next) });
    $('[data-hist]', main).innerHTML = historyHTML(next);
    if (prev && next.history.length > prev.history.length) $$('[data-history] li', main).slice(0, next.history.length - prev.history.length).forEach((li) => li.classList.add('new'));
    // A share that just arrived gets stamped.
    for (const c of next.collaborators) {
      const was = prev?.collaborators.find((p) => p.id === c.id)?.status;
      if (c.status !== 'PAID' || (prev ? was === 'PAID' : !replay)) continue;
      const row = $(`[data-collab="${CSS.escape(c.id)}"]`, main);
      if (!row) continue;
      if (!prev) row.style.setProperty('--stamp-delay', `${1500 + next.collaborators.indexOf(c) * 160}ms`);
      row.classList.add('stamped');
    }
    setProof(main, next.status);
    const acts = $('[data-actions]', main);
    acts.innerHTML = next.status === 'AWAITING_PAYMENT' ? `<a class="btn" href="#/quotes/${next.quoteId}">Back to the quote</a>`
      : next.status === 'ACTIVE' && next.payMode === 'payouts' ? `<button class="btn danger" data-refund>Refund and revoke</button><p class="small muted">Refunds the buyer in PayPal. The license voids when PayPal confirms it.</p>`
        : next.status === 'ACTIVE' ? '<p class="small muted">Each collaborator holds their own share; a refund is issued from their PayPal accounts.</p>' : '';
    $('[data-refund]', acts)?.addEventListener('click', async (e) => {
      if (!confirm(`Refund ${usd(next.total)} to ${next.brand} and revoke ${next.id}? This cannot be undone.`)) return;
      e.currentTarget.disabled = true;
      try { const r = await api(`/api/licenses/${next.id}/refund`, { method: 'POST' }); toast(r.note); } catch (ex) { toast(ex.message); e.currentTarget.disabled = false; }
    });
  };
  render(lic);
  if (replay) setTimeout(() => setProof(main, 'ACTIVE'), 650);

  stream?.close();
  stream = new EventSource(`/api/licenses/${id}/stream`);
  stream.onmessage = (m) => {
    const next = JSON.parse(m.data);
    if (JSON.stringify(next.history) === JSON.stringify(lic.history) && JSON.stringify(next.collaborators) === JSON.stringify(lic.collaborators)) return;
    const prev = lic;
    lic = next;
    render(next, prev);
    if (prev.status !== next.status) toast(`${LABEL[next.status] || next.status}`);
  };
}

async function viewRequests() {
  const [quotes, licenses] = await Promise.all([api('/api/quotes'), api('/api/licenses')]);
  const works = Object.fromEntries((await api('/api/works')).map((w) => [w.id, w]));
  const lic = Object.fromEntries(licenses.map((l) => [l.id, l]));
  main.innerHTML = `<section class="page"><h1>Requests</h1><p class="lede">Every brand request, read and priced. Open one to see the reasoning line by line.</p>
    ${quotes.length ? `<table class="table"><thead><tr><th>Brand</th><th>Work</th><th>Request</th><th>Total</th><th>State</th></tr></thead><tbody>
      ${quotes.map((q) => { const s = lic[q.licenseId]?.status || 'QUOTED'; return `<tr data-href="#/quotes/${q.id}"><td><a href="#/quotes/${q.id}">${esc(q.brand)}</a></td><td>${esc(works[q.workId]?.title)}</td><td><span class="req">${esc(q.request)}</span></td><td class="money">${usd(q.total)}</td><td><span class="pill ${s}">${esc(LABEL[s])}</span></td></tr>`; }).join('')}
    </tbody></table>` : `<div class="empty"><h3>No requests yet</h3><p>Send a brand the request page for one of your works. Their request lands here, already priced.</p><a class="btn" href="#/request/spring-poster">Try the request page ${I.arrow}</a></div>`}
  </section>`;
  rowLinks();
}

async function viewLicenses() {
  const licenses = await api('/api/licenses');
  main.innerHTML = `<section class="page"><h1>Licenses</h1><p class="lede">A license exists once a brand starts paying. Its state changes only when PayPal says so.</p>
    ${licenses.length ? `<table class="table"><thead><tr><th>License</th><th>Work</th><th>Brand</th><th>Paid</th><th>State</th></tr></thead><tbody>
      ${licenses.map((l) => `<tr data-href="#/licenses/${l.id}"><td><a href="#/licenses/${l.id}">${esc(l.id)}</a></td><td>${esc(l.work?.title)}</td><td>${esc(l.brand)}</td><td class="money">${usd(l.total)}</td><td><span class="pill ${l.status}">${esc(LABEL[l.status] || l.status)}</span></td></tr>`).join('')}
    </tbody></table>` : `<div class="empty"><h3>No licenses yet</h3><p>A license appears here as soon as a brand starts paying for a quote.</p><a class="btn" href="#/requests">See requests</a></div>`}
  </section>`;
  rowLinks();
}

function rowLinks() {
  $$('tr[data-href]', main).forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('a')) location.hash = tr.dataset.href; }));
}

// ---------- router ----------

const routes = [
  [/^#?\/?$/, () => viewWorks(), 'works', 'works'],
  [/^#\/works$/, () => viewWorks(), 'works', 'works'],
  [/^#\/works\/([\w-]+)$/, (m) => viewWork(m[1]), 'works', 'work'],
  [/^#\/request\/([\w-]+)$/, (m) => viewRequest(m[1]), 'requests', 'request'],
  [/^#\/requests$/, () => viewRequests(), 'requests', 'requests'],
  [/^#\/quotes\/([\w-]+)$/, (m, p) => viewQuote(m[1], p), 'requests', 'quote'],
  [/^#\/licenses$/, () => viewLicenses(), 'licenses', 'licenses'],
  [/^#\/licenses\/([\w-]+)$/, (m, p) => viewLicense(m[1], p), 'licenses', 'license'],
];

// Fetch first, then swap inside a view transition so the old page cross-fades into the new one.
async function router() {
  stream?.close();
  stream = null;
  const [path, query] = (location.hash || '#/works').split('?');
  const params = new URLSearchParams(query || '');
  for (const [rx, view, nav, key] of routes) {
    const m = path.match(rx);
    if (!m) continue;
    $$('[data-nav]').forEach((a) => a.removeAttribute('aria-current'));
    $(`[data-nav="${nav}"]`)?.setAttribute('aria-current', 'page');
    const render = async () => {
      try {
        await view(m, params);
      } catch (e) {
        main.innerHTML = `<section class="page"><h1>That page could not load</h1><p class="lede">${esc(e.message)}</p><p style="margin-top:18px"><a class="btn" href="#/works">Back to works</a></p></section>`;
      }
      window.scrollTo(0, 0);
    };
    if (document.startViewTransition && !reduced && router.ran) {
      const vt = document.startViewTransition(render);
      vt.ready.catch(() => {}); // a skipped transition (e.g. a second click mid-fade) is not an error
      vt.finished.catch(() => {});
      await vt.updateCallbackDone;
    } else await render();
    router.ran = true;
    main.focus({ preventScroll: true });
    $('h1', main)?.classList.add('print-in');
    explainRoute(key);
    counts();
    return;
  }
  location.hash = '#/works';
}

async function counts() {
  try {
    const [q, l] = await Promise.all([api('/api/quotes'), api('/api/licenses')]);
    $('[data-count="requests"]').textContent = q.length || '';
    $('[data-count="licenses"]').textContent = l.length || '';
  } catch { /* counts are decoration */ }
}

api('/api/health').then((h) => {
  $('[data-health]').textContent = `PayPal sandbox · AI: ${h.ai.provider === 'gemini' ? h.ai.model : 'offline reader'}`;
}).catch(() => {});

initExplain();
addEventListener('hashchange', router);
router();
