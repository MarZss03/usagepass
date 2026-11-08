# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Plain HTML/CSS/JS pages served by a zero-dependency Node server (Node 22, built-in `fetch`/`http`). Reuses the sandbox spike's PayPal client (`spike/paypal.mjs`) and its signature-verified webhook receiver. Deploy target: Render (stable URL; also eligible for the Render sponsor prize). AI: Google Gemini API, free tier, key held server-side only (`GEMINI_API_KEY`), with a clearly labelled offline rule parser when no key or quota is available.

## Users

- **Primary: small independent creator teams** (2–5 people who made one work together, e.g. lead designer, animator, voice artist). They want brands to use their work in paid ads only on terms they set, to be paid upfront, and to have each collaborator paid their agreed share without chasing anyone.
- **Buyer: small and mid-size brands and agencies** who want to run a creator's work in ads and need to know exactly what they may do with it, then pay and get going the same day.
- Out of scope: large brands already served by Aspire, Cruva and similar creator platforms.

## Product Purpose

UsagePass turns a brand's plain-language request to use a creative work into a priced, itemised usage license, and makes the PayPal payment itself the switch: payment captured → license active → every collaborator paid their share. A refund or chargeback revokes the license automatically. Success is that a brand can go from "can we run this on TikTok in the US for 90 days?" to an active license, and every creator gets paid, without a negotiation thread or an invoice.

## Positioning

- The payment is the license: license state is driven only by signature-verified PayPal webhooks (approved → pending, captured → active, refunded/reversed → revoked), not by someone ticking a box.
- Multi-collaborator payment by default: one checkout pays each collaborator directly (multi-payee Orders v2), or Payouts splits the net by agreed percentages.
- The AI reads the request against the creators' own rate card and permitted uses. Prices come from the rate card, never from the model. Every term it produces cites the rate-card clause it rests on, and it refuses uses the creators excluded (e.g. AI model training) before any order exists.

## Operating Context

- Creator side: describe the work, set a rate card (base license, add-ons per channel/territory/duration), list excluded uses, set the split between collaborators and their PayPal emails.
- Brand side: write a request in one sentence, review the AI's itemised quote with citations, pay with PayPal (sandbox), receive the license.
- License page: shows license state live as PayPal events arrive, plus each collaborator's payout status. This is the shot the demo video ends on.
- Everything runs in the PayPal sandbox for the hackathon.

## Capabilities and Constraints

Proven in the sandbox (spike, 2026-11-07/08): Orders v2 create/approve/capture with itemised lines and `custom_id`; Payouts 70/20/10 of net; multi-payee order with three purchase units to three accounts; webhook delivery through a public URL with `verify-webhook-signature`; license `PENDING` → `ACTIVE` with payout results recorded.

Constraints and open facts:
- Hackathon deadline: 2026-11-12 12:00 PT. Rules require AI integrated into the app, PayPal integration central, public repo with an open-source license file, a working demo (hosted URL or setup instructions), English materials, a video under 3 minutes.
- Live multi-payee and live Payouts may need PayPal partner onboarding/approval; must be stated honestly, not claimed.
- AI output is not legal advice; the license is a usage grant summary, and low-confidence terms go to the creators to confirm.
- Undecided: open-source license choice (user decides); whether to add an agent-callable (MCP) interface.

## Brand Commitments

Name: UsagePass (chosen 2026-11-08 after "RightsRail" was found taken by a similar project). All product copy in English.

## Evidence on Hand

- Sandbox run logs in `spike/logs/` (gitignored) and results recorded in `spike/README.md`.
- Market research from ideation (not to be presented as UsagePass customer evidence): 77% of brands use creator content in paid ads and 67% put paid usage in the initial contract (Aspire); 41% of creators name late payment their top pain (Traackr); 38.5% are paid more than a month late (Lumanu); no standard usage terms (Digiday).
- No customers, testimonials or real creator works exist. Demo works, creators and brands are fictional and must be labelled as sample data.

## Product Principles

1. Payment is the source of truth: state changes only from verified PayPal events.
2. The model proposes, the rate card decides: AI never sets a price and always shows the clause behind each term.
3. Say no early: excluded uses are refused before checkout, with the reason.
4. Everyone who made the work gets paid, visibly.
5. Plain words over legalese: a brand should understand what they may do in one read.

## Accessibility & Inclusion

Target WCAG 2.2 AA; motion respects `prefers-reduced-motion`.
