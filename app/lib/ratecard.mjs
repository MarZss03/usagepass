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
      creators: [
        { id: 'maya', name: 'Maya Chen', role: 'Lead designer', pct: 70, emailEnv: 'PAYEE_LEAD_EMAIL' },
        { id: 'tomas', name: 'Tomás Reyes', role: 'Animator', pct: 20, emailEnv: 'PAYEE_ANIMATOR_EMAIL' },
        { id: 'ines', name: 'Ines Okafor', role: 'Voice artist', pct: 10, emailEnv: 'PAYEE_VOICE_EMAIL' },
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
        { id: '9', kind: 'excluded', title: 'Never licensed', uses: ['Training or fine-tuning AI models', 'Political or issue advertising', 'Tobacco, vaping or gambling'], text: 'Training AI models on the work; political or issue ads; tobacco, vaping or gambling.' },
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
      creators: [
        { id: 'tomas', name: 'Tomás Reyes', role: 'Animator', pct: 60, emailEnv: 'PAYEE_ANIMATOR_EMAIL' },
        { id: 'ines', name: 'Ines Okafor', role: 'Sound', pct: 40, emailEnv: 'PAYEE_VOICE_EMAIL' },
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

// Turns an interpretation (from the AI or the offline reader) into priced lines.
// Every line cites its clause; nothing is priced that the rate card does not price.
export function priceRequest(work, it) {
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
  if (it.edits === 'recut') lines.push({ key: 'edits', label: 'Recrop or recut', amount: edits.prices.recut, evidence: it.editsEvidence || null, ...cite(edits) });

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
  for (const x of it.excluded || []) {
    const use = never.uses[x.useIndex] || x.use;
    refused.push({ key: `excluded-${x.useIndex}`, label: x.label || use, reason: `On this work’s never-licensed list: ${use}.`, evidence: x.evidence || null, ...cite(never) });
  }
  for (const u of it.unclear || []) review.push({ key: `unclear-${review.length}`, label: u.question, evidence: u.evidence || null });

  // An excluded *use* (training a model) drops that one line. An excluded *purpose*
  // (advertising alcohol, tobacco, politics) taints the whole request, so nothing is sold.
  const purpose = (it.excluded || []).map((x) => never.uses[x.useIndex]).find((u) => /advertis|tobacco|vap|gambl|alcohol|politic/i.test(u || ''));
  if (purpose) {
    return { lines: [], refused, review, total: 0, currency: 'USD', blocked: `The request is for ${purpose.toLowerCase()}, which this work is never licensed for, so none of it can be sold.`, wouldHaveBeen: lines };
  }

  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, refused, review, total, currency: 'USD' };
}

// Floors each share and gives the rounding remainder to the first (lead) collaborator.
export function splitCents(total, creators) {
  const parts = creators.map((c) => Math.floor((total * c.pct) / 100));
  parts[0] += total - parts.reduce((a, b) => a + b, 0);
  return parts;
}

export const money = (cents) => (cents / 100).toFixed(2);
