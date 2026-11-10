# Devpost submission text

**Name:** UsagePass

**Tagline (≤ 200 chars):** License collaborative creative work in minutes: every rights holder consents, Gemini checks the request against each of their terms, and one PayPal checkout pays every contributor.

**Links**
- Live demo: https://usagepass.onrender.com (PayPal sandbox)
- Code (MIT): https://github.com/MarZss03/usagepass
- Video: https://youtu.be/1CbzMCr0WIA

**Built with:** PayPal Orders v2 (multi-payee), PayPal Payouts, PayPal Webhooks (signature verification), PayPal Payments v2 refunds, Google Gemini (structured output), Node.js, vanilla JavaScript, Render

---

## Inspiration

Most creative work that brands want to license is made by more than one person: an illustrator, an animator, a voice artist. When a brand asks to “use the poster in some ads”, what follows is an email thread, a guessed price, an invoice to the lead creator, and weeks later a manual split. Nobody writes down what was bought, and the people with the smallest share are rarely asked whether they agree.

## What it does

A brand describes its use in one sentence. UsagePass:

1. **Reads the request with Gemini** into a structured request (platforms, paid media, run length, countries, edits, print, exclusivity, excluded uses). Each line is backed by the brand’s exact words, which are highlighted on the quote.
2. **Prices it only from the creators’ rate card.** The model never names a number. Uses the team never licenses (AI training, tobacco) are refused before any order exists.
3. **Checks every contributor’s own terms.** If a request conflicts with one person’s restriction, such as “no recut of my voiceover”, the AI quotes the words and names whose term it is. The engine then prices the alternatives: keep her part and drop the conflicting use, or remove her part and re-split the money among the rest.
4. **Confirms consent before payment.** “Rights approved by N/N contributors on this license, terms v3.”
5. **Pays everyone through PayPal.** One Orders v2 checkout has a purchase unit per contributor, each with its own payee, or the studio is paid and Payouts splits the net. The license turns **Active** only when PayPal’s signature-verified webhook confirms the capture. Each contributor’s capture ID appears on the license, and a refund revokes it.
6. **Produces a structured, auditable license record** from creator-approved terms, downloadable as data.

## How we built it

- **PayPal:**
  - Orders v2 with multiple purchase units and `payee.email_address` (or itemised lines plus `custom_id` in Payouts mode);
  - capture on return, with `PayPal-Request-Id` idempotency keys derived from the license id;
  - Payouts v1 for the percentage split;
  - Webhooks verified with `verify-webhook-signature` on the raw body, deduplicated and applied in order;
  - Payments v2 refunds, telling partial from full refunds.
- **Gemini:**
  - the `generateContent` endpoint with a JSON response schema;
  - server-side guardrails: evidence must be a verbatim substring of the request, vocabularies are fixed, and unsupported charges become questions;
  - retry, backup model, and a clearly labelled offline keyword reader.
- **App:**
  - a zero-dependency Node 22 server, a JSON store, and Server-Sent Events, so the license page updates live as PayPal events arrive;
  - a vanilla JS single-page app;
  - an “Explain this screen” mode that shows which API or AI step sits under each part.
- **Design:** a two-ink risograph proof whose plates sit out of register until PayPal confirms payment, then snap into register.

## Challenges

- Keeping the AI useful without letting it touch money. The fix: Gemini only interprets, the rate card prices, and every claim must be quotable from the brand’s text.
- Turning a contributor’s “no” into a choice instead of a refusal, with options computed deterministically from the same reading.
- Verifying webhooks byte for byte, and handling duplicate or out-of-order events.

## Accomplishments

- End to end in the PayPal sandbox: one checkout paying three separate accounts directly, verified webhooks driving the license state, and refunds revoking it.
- Gemini correctly maps indirect phrasing (“add it to our in-house generator’s dataset” → AI training; “a ballot measure” → a political-ad restriction; “a quarter” → 90 days).

## What we learned

The interesting part of licensing isn’t the price. It’s consent among several people, and a payment rail is a natural place to make that consent binding: no capture, no license.

## What’s next

- Contributors approve new terms versions from their own link.
- Live multi-party payments with PayPal partner onboarding.
- Exportable license certificates for brands’ legal teams.

_Sample works, studios, creators and brands are fictional. Everything runs in the PayPal sandbox. The license summary is not legal advice._
