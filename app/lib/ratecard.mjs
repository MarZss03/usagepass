// Rate cards and the pricing engine. Prices live here, never in the model's output:
// the AI reads the brand's request into an interpretation, and this file prices it clause by clause.

const regionName = new Intl.DisplayNames(['en'], { type: 'region' });
export const countryName = (code) => { try { return regionName.of(code); } catch { return code; } };

export const PLATFORMS = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', youtube: 'YouTube', x: 'X',
  linkedin: 'LinkedIn', pinterest: 'Pinterest', snapchat: 'Snapchat', website: 'Website', email: 'Email',
};

// Sample data. Names, studios and brands are fictional.
export function seedWorks() {
  return [
    {
      id: 'spring-poster',
      title: 'Spring launch poster',
      studio: 'Studio Paloma',
      medium: 'Illustrated poster with a 12-second animated cut and voiceover',
      art: 'spring',
      payMode: 'split', // 'split': one checkout pays each collaborator directly; 'payouts': captured to the studio, then split with Payouts
      home: ['CA'],
      termsVersion: 3,
      // Each contributor approves the card, owns a part of the work, and may add restrictions of their own.
      creators: [
        { id: 'maya', name: 'Maya Chen', role: 'Lead designer', pct: 70, emailEnv: 'PAYEE_LEAD_EMAIL', component: 'artwork', approved: { version: 3, at: '2026-11-06T15:12:00Z' }, restrictions: [] },
        { id: 'tomas', name: 'Tomás Reyes', role: 'Animator', pct: 20, emailEnv: 'PAYEE_ANIMATOR_EMAIL', component: 'animation', approved: { version: 3, at: '2026-11-06T16:40:00Z' }, restrictions: [] },
        {
          id: 'ines', name: 'Ines Okafor', role: 'Voice artist', pct: 10, emailEnv: 'PAYEE_VOICE_EMAIL', component: 'voiceover', removable: true,
          approved: { version: 3, at: '2026-11-07T09:05:00Z' },
          restrictions: [
            { id: 'ines-politics', kind: 'purpose', text: 'Political or issue advertising using my voice' },
            { id: 'ines-recut', kind: 'use', text: 'Recutting or re-editing the voiceover', when: { edits: 'recut' } },
          ],
        },
      ],
      clauses: [
        { id: '1', kind: 'base', title: 'Base license', price: 20000, text: 'One work, posted unpaid on the licensee’s own channels for 12 months.' },
        { id: '2', kind: 'platforms', title: 'Platforms', allowed: ['instagram', 'tiktok', 'facebook', 'youtube', 'x', 'linkedin', 'pinterest', 'website', 'email'], text: 'Instagram, TikTok, Facebook, YouTube, X, LinkedIn, Pinterest, the licensee’s website and email.' },
        { id: '3', kind: 'paid', title: 'Paid media', price: 8000, blockDays: 90, text: 'Paid placement on any listed platform, $80 per 90 days.' },
        { id: '4', kind: 'territory', title: 'Territory', price: 3000, text: 'Canada included. Each additional country $30.' },
        { id: '5', kind: 'term', title: 'Term', maxDays: 365, text: 'Paid media runs in 90-day blocks, up to 12 months. Longer runs need the team’s approval.' },
        { id: '6', kind: 'edits', title: 'Edits', prices: { none: 0, text: 0, recut: 4000 }, text: 'Caption and on-image text changes included. Recrops, recuts and colour changes $40.' },
        { id: '7', kind: 'ooh', title: 'Print and out of home', price: 15000, text: 'Posters, billboards and in-store print, $150.' },
        { id: '8', kind: 'exclusive', title: 'Exclusivity', text: 'Not sold off the card. Requests go to the team.' },
        { id: '9', kind: 'excluded', title: 'Never licensed', uses: ['Training or fine-tuning AI models', 'Tobacco, vaping or gambling'], text: 'Training AI models on the work; tobacco, vaping or gambling. Each contributor may add their own restrictions.' },
        { id: '10', kind: 'without', creator: 'ines', title: 'Silent cut', price: -3000, text: 'The animated cut without the voiceover, $30 off. The voice artist is then not a party to the license or the payment.' },
      ],
    },
    {
      id: 'night-market',
      title: 'Night market loop',
      studio: 'Okafor & Reyes',
      medium: '6-second looping animation with ambient sound',
      art: 'night',
      payMode: 'payouts',
      home: ['CA'],
      termsVersion: 1,
      creators: [
        { id: 'tomas', name: 'Tomás Reyes', role: 'Animator', pct: 60, emailEnv: 'PAYEE_ANIMATOR_EMAIL', component: 'animation', approved: { version: 1, at: '2026-11-05T18:20:00Z' }, restrictions: [] },
        { id: 'ines', name: 'Ines Okafor', role: 'Sound', pct: 40, emailEnv: 'PAYEE_VOICE_EMAIL', component: 'sound', approved: { version: 1, at: '2026-11-05T19:02:00Z' }, restrictions: [] },
      ],
      clauses: [
        { id: '1', kind: 'base', title: 'Base license', price: 12000, text: 'One work, posted unpaid on the licensee’s own channels for 12 months.' },
        { id: '2', kind: 'platforms', title: 'Platforms', allowed: ['instagram', 'tiktok', 'youtube', 'snapchat', 'website'], text: 'Instagram, TikTok, YouTube, Snapchat and the licensee’s website.' },
        { id: '3', kind: 'paid', title: 'Paid media', price: 6000, blockDays: 30, text: 'Paid placement on any listed platform, $60 per 30 days.' },
        { id: '4', kind: 'territory', title: 'Territory', price: 2500, text: 'Canada included. Each additional country $25.' },
        { id: '5', kind: 'term', title: 'Term', maxDays: 180, text: 'Paid media in 30-day blocks, up to 6 months.' },
        { id: '6', kind: 'edits', title: 'Edits', prices: { none: 0, text: 0, recut: 5000 }, text: 'Text overlays included. Recuts or loop changes $50.' },
        { id: '9', kind: 'excluded', title: 'Never licensed', uses: ['Training or fine-tuning AI models', 'Political or issue advertising', 'Alcohol advertising'], text: 'Training AI models on the work; political or issue ads; alcohol ads.' },
      ],
    },
  ];
}

const clause = (work, kind) => work.clauses.find((c) => c.kind === kind);
const cite = (c) => ({ clauseId: c.id, clauseTitle: c.title, clauseText: c.text });
const list = (xs) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

// The list the AI matches requests against: the work's never-licensed uses, then each
// contributor's own restrictions that need reading (structural ones, like "no recut", are checked in code).
export function restrictedUses(work) {
  const never = clause(work, 'excluded');
  const own = never.uses.map((text, i) => ({ id: `work-${i}`, text, owner: null, kind: /advertis|tobacco|vap|gambl|alcohol|politic/i.test(text) ? 'purpose' : 'use' }));
  const theirs = work.creators.flatMap((c) => (c.restrictions || []).filter((r) => !r.when).map((r) => ({ ...r, owner: c.id })));
  return [...own, ...theirs];
}

const pctLabel = (n) => `${Math.round(n * 10) / 10}%`;

// Who is party to the license and their share, after any contributor whose part is removed.
function splitFor(work, silent) {
  const party = work.creators.filter((c) => !silent.includes(c.id));
  const sum = party.reduce((s, c) => s + c.pct, 0);
  return party.map((c) => ({ id: c.id, name: c.name, role: c.role, component: c.component, pct: (c.pct * 100) / sum, basePct: c.pct, approved: c.approved }));
}

// Turns an interpretation (from the AI or the offline reader) into priced lines.
// Every line cites its clause; nothing is priced that the rate card does not price.
// `variant` records choices made to resolve a contributor's restriction:
//   drop:   restriction ids whose use is left out of the license
//   silent: contributor ids whose part of the work is removed (they are then not party to it)
export function priceRequest(work, it, variant = { drop: [], silent: [] }, depth = 0) {
  const v = { drop: [...(variant.drop || [])], silent: [...(variant.silent || [])] };
  const lines = [];
  const refused = [];
  const review = [];

  const base = clause(work, 'base');
  lines.push({ key: 'base', label: base.title, amount: base.price, evidence: it.summaryEvidence || null, ...cite(base) });

  const platforms = clause(work, 'platforms');
  const asked = [...new Set(it.platforms || [])];
  const allowed = asked.filter((p) => platforms.allowed.includes(p));
  for (const p of asked.filter((x) => !platforms.allowed.includes(x))) {
    refused.push({ key: `platform-${p}`, label: `${PLATFORMS[p] || p}`, reason: `Not on this work’s platform list.`, evidence: it.platformsEvidence || null, ...cite(platforms) });
  }

  if (it.paid) {
    const paid = clause(work, 'paid');
    const term = clause(work, 'term');
    let days = it.durationDays;
    if (!days) {
      days = paid.blockDays;
      review.push({ key: 'duration', label: `No run length given; priced one ${paid.blockDays}-day block`, evidence: null, ...cite(term) });
    }
    const maxBlocks = Math.floor(term.maxDays / paid.blockDays);
    let blocks = Math.ceil(days / paid.blockDays);
    if (blocks > maxBlocks) {
      blocks = maxBlocks;
      review.push({ key: 'term-long', label: `Asked for ${days} days; the card sells up to ${maxBlocks * paid.blockDays} days. Priced that, anything longer needs the team.`, evidence: it.durationEvidence || null, ...cite(term) });
    }
    const where = allowed.length ? ` · ${list(allowed.map((p) => PLATFORMS[p]))}` : '';
    lines.push({ key: 'paid', label: `Paid ads, ${blocks * paid.blockDays} days${where}`, amount: paid.price * blocks, qty: blocks, evidence: it.paidEvidence || it.durationEvidence || null, ...cite(paid) });
  }

  const terr = clause(work, 'territory');
  const extra = [...new Set((it.territories || []).map((c) => c.toUpperCase()))].filter((c) => !work.home.includes(c));
  for (const c of extra) {
    lines.push({ key: `territory-${c}`, label: `Extra territory: ${countryName(c)}`, amount: terr.price, evidence: it.territoryEvidence || null, ...cite(terr) });
  }

  const edits = clause(work, 'edits');
  if (it.edits === 'text') lines.push({ key: 'edits', label: 'Caption and text edits', amount: edits.prices.text, evidence: it.editsEvidence || null, ...cite(edits) });
  if (it.edits === 'recut') {
    // A recut the voice artist has not allowed is left out when the brand chose to keep the voice.
    const blockedBy = work.creators.flatMap((c) => (c.restrictions || []).filter((r) => r.when?.edits === 'recut' && v.drop.includes(r.id) && !v.silent.includes(c.id)).map((r) => ({ r, c })))[0];
    if (blockedBy) refused.push({ key: 'edits', label: 'Recrop or recut', reason: `Left out to keep ${blockedBy.c.name}’s ${blockedBy.c.component}: ${blockedBy.r.text.toLowerCase()} is not allowed.`, evidence: it.editsEvidence || null, owner: blockedBy.c.id });
    else lines.push({ key: 'edits', label: 'Recrop or recut', amount: edits.prices.recut, evidence: it.editsEvidence || null, ...cite(edits) });
  }

  for (const cid of v.silent) {
    const w = work.clauses.find((c) => c.kind === 'without' && c.creator === cid);
    const who = work.creators.find((c) => c.id === cid);
    if (w && who) lines.push({ key: `without-${cid}`, label: `${w.title}: without the ${who.component}`, amount: w.price, evidence: null, ...cite(w) });
  }

  if (it.outOfHome) {
    const ooh = clause(work, 'ooh');
    if (ooh) lines.push({ key: 'ooh', label: 'Print and out of home', amount: ooh.price, evidence: it.oohEvidence || null, ...cite(ooh) });
    else refused.push({ key: 'ooh', label: 'Print and out of home', reason: 'This work is not licensed for print.', evidence: it.oohEvidence || null, ...cite(clause(work, 'base')) });
  }

  if (it.exclusive) {
    const ex = clause(work, 'exclusive');
    if (ex) review.push({ key: 'exclusive', label: 'Exclusivity is not sold off the card; the team will reply separately.', evidence: it.exclusiveEvidence || null, ...cite(ex) });
    else refused.push({ key: 'exclusive', label: 'Exclusivity', reason: 'Not offered for this work.', evidence: it.exclusiveEvidence || null, ...cite(clause(work, 'base')) });
  }

  const never = clause(work, 'excluded');
  const restricted = restrictedUses(work);
  const conflicts = [];
  let purpose = null;
  const byId = Object.fromEntries(work.creators.map((c) => [c.id, c]));

  // Restrictions the reading matched by meaning (index into restrictedUses).
  const hits = (it.excluded || []).map((x) => ({ x, r: restricted[x.useIndex] })).filter((h) => h.r);
  // Restrictions checked in code against the structured reading.
  const structural = work.creators.flatMap((c) => (c.restrictions || []).filter((r) => r.when && Object.entries(r.when).every(([k, val]) => it[k] === val)).map((r) => ({ x: { evidence: it.editsEvidence, label: r.text }, r: { ...r, owner: c.id } })));

  for (const { x, r } of [...hits, ...structural]) {
    if (!r.owner) {
      // The whole team's never-licensed list.
      refused.push({ key: `excluded-${x.useIndex}`, label: x.label || r.text, reason: `On this work’s never-licensed list: ${r.text}.`, evidence: x.evidence || null, ...cite(never) });
      if (r.kind === 'purpose') purpose = purpose || r.text;
      continue;
    }
    const who = byId[r.owner];
    if (v.silent.includes(r.owner)) continue; // their part is removed, so their restriction no longer applies
    if (r.kind === 'use' && v.drop.includes(r.id)) continue; // handled where the line is priced
    conflicts.push({ key: r.id, restriction: r.text, kind: r.kind, creatorId: r.owner, creator: who.name, role: who.role, component: who.component, evidence: x.evidence || null });
  }
  for (const u of it.unclear || []) review.push({ key: `unclear-${review.length}`, label: u.question, evidence: u.evidence || null });

  // An excluded *purpose* on the team's list taints the whole request, so nothing is sold.
  if (purpose) {
    return { lines: [], refused, review, total: 0, currency: 'USD', blocked: `The request is for ${purpose.toLowerCase()}, which this work is never licensed for, so none of it can be sold.`, wouldHaveBeen: lines, conflicts: [], split: splitFor(work, v.silent), variant: v, payable: false };
  }

  // A contributor's own restriction does not end the request: it offers ways through, each priced in full.
  if (depth === 0) {
    for (const k of conflicts) {
      const opts = [];
      if (k.kind === 'use') {
        const o = priceRequest(work, it, { ...v, drop: [...v.drop, k.key] }, 1);
        opts.push({ key: 'keep', variant: o.variant, title: `Keep ${k.creator.split(' ')[0]}’s ${k.component}`, summary: `Leave out the part ${k.creator.split(' ')[0]} does not allow. Everyone stays on the license.`, total: o.total, payable: o.payable, parties: o.split.length });
      }
      if (byId[k.creatorId]?.removable && work.clauses.some((c) => c.kind === 'without' && c.creator === k.creatorId)) {
        const o = priceRequest(work, it, { ...v, silent: [...v.silent, k.creatorId] }, 1);
        opts.push({ key: 'without', variant: o.variant, title: `Remove the ${k.component}`, summary: `Keep everything you asked for without ${k.creator.split(' ')[0]}’s ${k.component}. ${k.creator.split(' ')[0]} is not on the license; the split becomes ${o.split.map((p) => `${p.name.split(' ')[0]} ${pctLabel(p.pct)}`).join(', ')}.`, total: o.total, payable: o.payable, parties: o.split.length });
      }
      k.options = opts;
    }
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);
  const split = splitFor(work, v.silent);
  return { lines, refused, review, total, currency: 'USD', conflicts, split, variant: v, payable: total > 0 && conflicts.length === 0 };
}

// Floors each share and gives the rounding remainder to the first (lead) collaborator.
export function splitCents(total, creators) {
  const parts = creators.map((c) => Math.floor((total * c.pct) / 100));
  parts[0] += total - parts.reduce((a, b) => a + b, 0);
  return parts;
}

export const money = (cents) => (cents / 100).toFixed(2);
