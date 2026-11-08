// Reads a brand's plain-language request against a work's rate card.
// The model returns an interpretation (what was asked, with the exact words that ask it);
// it never returns prices. Evidence that is not a verbatim part of the request is dropped.
import { PLATFORMS } from './ratecard.mjs';
import { env } from './paypal.mjs';

const MODEL = () => env('GEMINI_MODEL', 'gemini-2.5-flash');

const S = (type, extra = {}) => ({ type, ...extra });
const SCHEMA = S('OBJECT', {
  properties: {
    summary: S('STRING', { description: 'One plain sentence: what the brand wants to do with the work.' }),
    summaryEvidence: S('STRING'),
    platforms: S('ARRAY', { items: S('STRING', { enum: Object.keys(PLATFORMS) }) }),
    platformsEvidence: S('STRING'),
    paid: S('BOOLEAN', { description: 'True if they will pay to promote it (ads, boosting, sponsored, paid social).' }),
    paidEvidence: S('STRING'),
    durationDays: S('INTEGER', { description: 'How long paid use runs, in days. 0 if not stated.' }),
    durationEvidence: S('STRING'),
    territories: S('ARRAY', { items: S('STRING', { description: 'ISO 3166-1 alpha-2 country code' }) }),
    territoryEvidence: S('STRING'),
    edits: S('STRING', { enum: ['none', 'text', 'recut'], description: 'text = captions or on-image text; recut = crop, recut, recolour, re-edit the artwork' }),
    editsEvidence: S('STRING'),
    outOfHome: S('BOOLEAN', { description: 'Print, posters, billboards, in-store or other physical display.' }),
    oohEvidence: S('STRING'),
    exclusive: S('BOOLEAN'),
    exclusiveEvidence: S('STRING'),
    excluded: S('ARRAY', {
      description: 'Requested uses that fall under the never-licensed list.',
      items: S('OBJECT', {
        properties: {
          useIndex: S('INTEGER', { description: 'Index into the never-licensed list.' }),
          label: S('STRING', { description: 'Short name of what they asked for, in their terms.' }),
          evidence: S('STRING'),
        },
        required: ['useIndex', 'label', 'evidence'],
      }),
    }),
    unclear: S('ARRAY', {
      description: 'Anything asked that the rate card does not cover or that is ambiguous, as a question for the creators.',
      items: S('OBJECT', { properties: { question: S('STRING'), evidence: S('STRING') }, required: ['question', 'evidence'] }),
    }),
  },
  required: ['summary', 'summaryEvidence', 'platforms', 'paid', 'durationDays', 'territories', 'edits', 'outOfHome', 'exclusive', 'excluded', 'unclear'],
});

function instructions(work) {
  const never = work.clauses.find((c) => c.kind === 'excluded');
  const platforms = work.clauses.find((c) => c.kind === 'platforms');
  return [
    'You read requests from brands who want to use a creative work, and record exactly what they ask for. You do not price anything and you do not decide what is allowed; a rate card does that after you.',
    'Every *Evidence field must be copied character for character from the request (the shortest phrase that shows it), or be an empty string when the request does not say it. Never paraphrase evidence.',
    'Only record what the request actually asks. Do not add uses, platforms or countries they did not mention. If they say "North America" that is CA and US; "worldwide" or "global" is unclear, so ask.',
    `Platform names to use: ${Object.keys(PLATFORMS).join(', ')}. A platform not in that list goes in "unclear".`,
    `The work's home territory is ${work.home.join(', ')}; still list it in territories if they mention it.`,
    `Never-licensed list (by index): ${never.uses.map((u, i) => `${i}: ${u}`).join('; ')}. Anything they ask that matches one of these goes in "excluded" with that index, even if phrased indirectly (e.g. "add it to our image model dataset" is training AI models).`,
    `This work's listed platforms: ${platforms.allowed.join(', ')}.`,
  ].join('\n');
}

async function readWithGemini(work, request) {
  const key = env('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instructions(work) }] },
      contents: [{ role: 'user', parts: [{ text: `Work: ${work.title} (${work.medium}).\nRequest:\n"""${request}"""` }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${data.error?.message || 'request failed'}`);
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
  if (!text) throw new Error(`Gemini returned no content (${data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || 'unknown'})`);
  return JSON.parse(text);
}

// ---------- offline reader (no key, quota exhausted, or the API is down) ----------

const WORD_NUM = { one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const COUNTRIES = [
  [/\bcanad(a|ian)\b/i, ['CA']], [/\b(united states|usa|america)\b/i, ['US']], [/\b(US|U\.S\.)\b/, ['US']],
  [/\bnorth america\b/i, ['CA', 'US']], [/\b(uk|united kingdom|britain|england)\b/i, ['GB']], [/\bmexic/i, ['MX']],
  [/\baustralia/i, ['AU']], [/\bgerman/i, ['DE']], [/\bfrance|french\b/i, ['FR']], [/\bjapan/i, ['JP']], [/\bbrazil/i, ['BR']], [/\bindia\b/i, ['IN']],
];
const PLATFORM_RX = {
  instagram: /\b(instagram|insta|ig|reels)\b/i, tiktok: /\btik ?tok\b/i, facebook: /\b(facebook|fb|meta ads)\b/i, youtube: /\b(youtube|yt|shorts)\b/i,
  x: /\b(twitter|x\.com)\b/i, linkedin: /\blinkedin\b/i, pinterest: /\bpinterest\b/i, snapchat: /\bsnap(chat)?\b/i, website: /\b(website|site|landing page|homepage)\b/i, email: /\b(email|newsletter)\b/i,
};
// "poster" is left out on purpose: brands call the work itself "the poster".
const OOH_RX = /\b(billboards?|print(ed)?|in-store|out of home|ooh|signage|flyers?|bus shelters?|posters? in)\b/i;
const NEVER_RX = [
  /\b(train\w*|fine[- ]?tun\w*|dataset|data set|model training|image model|ai model|lora)\b/i,
  /\b(politic\w*|election|campaign for|ballot|issue ad\w*|advocacy)\b/i,
  /\b(tobacco|vap(e|ing)|cigar\w*|gambl\w*|casino|betting|alcohol|beer|wine|liquor)\b/i,
];

function readOffline(work, request) {
  const r = request;
  const grab = (rx) => r.match(rx)?.[0] || '';
  const platforms = Object.entries(PLATFORM_RX).filter(([, rx]) => rx.test(r)).map(([k]) => k);
  const paidEvidence = grab(/\b(paid( ads?| social| media)?|ads?|advert\w*|boost\w*|sponsor\w*|promot\w*|campaign)\b/i);
  let durationDays = 0;
  let durationEvidence = '';
  const d = r.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an)\s*(day|week|month|year)s?\b/i);
  if (d) {
    const n = Number(d[1]) || WORD_NUM[d[1].toLowerCase()] || 1;
    durationDays = n * { day: 1, week: 7, month: 30, year: 365 }[d[2].toLowerCase()];
    durationEvidence = d[0];
  } else if (/\bquarter\b/i.test(r)) { durationDays = 90; durationEvidence = grab(/\b(a |one )?quarter\b/i); }
  const territories = [];
  const terrEv = [];
  for (const [rx, codes] of COUNTRIES) { const m = r.match(rx); if (m) { territories.push(...codes); terrEv.push(m[0]); } }
  const recut = grab(/\b(re-?cut|re-?crop|crop\w*|recolou?r\w*|re-?edit\w*|change the colou?rs?|shorten)\b/i);
  const text = grab(/\b(caption\w*|copy|headline|text|tagline|logo)\b/i);
  const never = work.clauses.find((c) => c.kind === 'excluded');
  const excluded = [];
  NEVER_RX.forEach((rx, i) => {
    const m = r.match(rx);
    const idx = never.uses.findIndex((u) => rx.test(u));
    if (!m || idx < 0) return;
    excluded.push({ useIndex: idx, label: never.uses[idx], evidence: m[0] });
  });
  const unclear = [];
  if (/\b(worldwide|global(ly)?|everywhere|international)\b/i.test(r)) unclear.push({ question: 'Which countries exactly? Worldwide is not on the card.', evidence: grab(/\b(worldwide|global(ly)?|everywhere|international)\b/i) });
  return {
    summary: 'Read with the offline rule reader (no AI): keyword matches only.',
    summaryEvidence: '',
    platforms, platformsEvidence: platforms.length ? grab(PLATFORM_RX[platforms[0]]) : '',
    paid: Boolean(paidEvidence), paidEvidence,
    durationDays, durationEvidence,
    territories, territoryEvidence: terrEv.find((t) => !/canad/i.test(t)) || terrEv[0] || '',
    edits: recut ? 'recut' : text ? 'text' : 'none', editsEvidence: recut || text,
    outOfHome: OOH_RX.test(r), oohEvidence: grab(OOH_RX),
    exclusive: /\bexclusiv/i.test(r), exclusiveEvidence: grab(/\bexclusiv\w*/i),
    excluded, unclear,
  };
}

// ---------- guardrails on the interpretation ----------

function clean(work, request, it) {
  const lower = request.toLowerCase();
  const ev = (s) => (typeof s === 'string' && s.trim() && lower.includes(s.trim().toLowerCase()) ? s.trim() : '');
  const never = work.clauses.find((c) => c.kind === 'excluded');
  const out = {
    summary: String(it.summary || '').slice(0, 300),
    summaryEvidence: ev(it.summaryEvidence),
    platforms: [...new Set((it.platforms || []).filter((p) => p in PLATFORMS))],
    platformsEvidence: ev(it.platformsEvidence),
    paid: Boolean(it.paid), paidEvidence: ev(it.paidEvidence),
    durationDays: Math.max(0, Math.min(3650, Math.round(Number(it.durationDays) || 0))), durationEvidence: ev(it.durationEvidence),
    territories: [...new Set((it.territories || []).map((c) => String(c).toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)))],
    territoryEvidence: ev(it.territoryEvidence),
    edits: ['none', 'text', 'recut'].includes(it.edits) ? it.edits : 'none', editsEvidence: ev(it.editsEvidence),
    outOfHome: Boolean(it.outOfHome), oohEvidence: ev(it.oohEvidence),
    exclusive: Boolean(it.exclusive), exclusiveEvidence: ev(it.exclusiveEvidence),
    excluded: (it.excluded || []).filter((x) => Number.isInteger(x.useIndex) && x.useIndex >= 0 && x.useIndex < never.uses.length)
      .map((x) => ({ useIndex: x.useIndex, label: String(x.label || never.uses[x.useIndex]).slice(0, 80), evidence: ev(x.evidence) })),
    unclear: (it.unclear || []).slice(0, 5).map((u) => ({ question: String(u.question || '').slice(0, 200), evidence: ev(u.evidence) })).filter((u) => u.question),
  };
  // A claim with no supporting words in the request is not trusted enough to charge for.
  const unsupported = [];
  if (out.paid && !out.paidEvidence && !out.durationEvidence) unsupported.push('paid ads');
  if (out.outOfHome && !out.oohEvidence) { out.outOfHome = false; unsupported.push('print'); }
  if (out.edits === 'recut' && !out.editsEvidence) { out.edits = 'none'; unsupported.push('recut'); }
  for (const u of unsupported) out.unclear.push({ question: `The reading suggested ${u}, but no words in the request say so. Confirm before adding it.`, evidence: '' });
  return out;
}

export async function readRequest(work, request) {
  const started = Date.now();
  try {
    const raw = await readWithGemini(work, request);
    return { source: 'gemini', model: MODEL(), ms: Date.now() - started, interpretation: clean(work, request, raw) };
  } catch (e) {
    return { source: 'offline', reason: e.message, ms: Date.now() - started, interpretation: clean(work, request, readOffline(work, request)) };
  }
}
