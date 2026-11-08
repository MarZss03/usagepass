# UsagePass

**License collaborative creative work in minutes. Every rights holder consents, AI checks the request against each of their terms, and PayPal pays every contributor verifiably.**

Live demo: https://usagepass.onrender.com (PayPal sandbox; press **Explain this screen** or `?` on any page)

Small creator teams (a designer, an animator, a voice artist) get asked all the time whether a brand can "use the poster in some ads." What follows is a thread of vague emails, a guessed price, an invoice, and weeks of waiting, after which the lead creator has to split the money by hand. Usage terms are rarely written down, so nobody is sure what was bought.

UsagePass replaces that thread with three steps:

1. **The brand writes a request** in plain English: *"Paid ads on Instagram and TikTok in Canada and the US for three months, edit the caption, and train our image model on it."*
2. **The AI reads it, the rate card prices it.** Gemini turns the sentence into a structured reading (platforms, paid or not, run length, countries, edits, print, exclusivity, excluded uses), quoting the exact words each line is based on. The server prices each line from the team's own rate card and cites the clause. Uses on the team's never-licensed list (here: AI training) are refused before any order exists.
3. **Payment is the switch.** The brand pays with PayPal. One checkout pays each collaborator directly (multi-payee Orders v2), or the studio is paid and the net is split with Payouts. The license becomes **Active** only when PayPal confirms the capture with a signature-verified webhook, and a refund or chargeback revokes it.

The interface shows this as a two-ink risograph proof: its pink and blue plates sit out of register until PayPal confirms the payment, then snap into register.

> Sample works, studios, creators and brands are fictional. Everything runs in the PayPal sandbox.

## Every contributor consents

A work is made by several people, and each of them can set terms of their own. In the sample, Ines (voice artist, 10%) allows the poster to be licensed, but not her voice in political or issue ads, and not a recut of her voiceover.

- Each contributor owns a component (artwork, animation, voiceover), has approved a numbered version of the terms (with a date), and may add restrictions.
- Gemini reads the request against the team’s never-list **and** each contributor’s restrictions, quotes the words that conflict, and names whose term it is.
- Instead of a dead end, the engine prices the ways through from the rate card: **A. keep her part and drop what she does not allow**, or **B. remove her part** (the “silent cut” clause) and re-split the money among the remaining contributors. The brand picks one; the quote is re-priced from the same reading, so the AI is not asked again and numbers cannot drift.
- Before payment a card states exactly what is and isn’t licensed and that it was *approved by N/N contributors on this license, terms vN*. Checkout is refused while a conflict is open.
- After payment the license shows each contributor’s PayPal capture id and the PayPal fee row, and can be downloaded as a structured, auditable license record.
- A full refund revokes the license; a partial refund keeps it active and is recorded as an amendment.

## How PayPal is used

| What | PayPal API | Where |
|---|---|---|
| Itemised license order, one purchase unit per collaborator with its own `payee` (split mode), or one unit with line items (Payouts mode); license id in `custom_id` | Orders v2 `POST /v2/checkout/orders` | `app/lib/licenses.mjs` `checkout()` |
| Capture when the buyer returns | Orders v2 `POST /v2/checkout/orders/{id}/capture` | `captureOnReturn()` |
| License state from PayPal's own events: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED / PENDING / DENIED / REFUNDED / REVERSED`, `PAYMENT.PAYOUTS-ITEM.*` | Webhooks + `POST /v1/notifications/verify-webhook-signature` (raw body, byte for byte) | `app/server.mjs`, `applyEvent()` |
| Split the net to collaborators by agreed percentages (Payouts mode) | Payouts `POST /v1/payments/payouts` | `maybePayout()` |
| Refund and revoke | Payments v2 `POST /v2/payments/captures/{id}/refund` | `/api/licenses/:id/refund` |

Idempotency keys (`PayPal-Request-Id`) are derived from the license id, so a retried checkout or capture cannot double-charge. Duplicate webhook deliveries are applied once; events are applied in order.

## How AI is used

`app/lib/ai.mjs` sends the request and the work's rate card to Gemini with a JSON response schema. The model returns an *interpretation*, never a price. Guardrails on its output:

- Every piece of evidence must appear word for word in the brand's request, or it is dropped. The UI highlights those words, and hovering a priced line lights up the words it came from.
- Platforms, countries and edit levels are validated against fixed vocabularies.
- A charge with no supporting words in the request is turned into a question for the creators instead of a line item.
- Excluded uses (training AI models, political ads, and so on) are matched even when phrased indirectly ("add it to our image model dataset").
- Prices, blocks of days, territory add-ons and caps come only from `app/lib/ratecard.mjs`.

Without `GEMINI_API_KEY`, or if the API fails, a deterministic keyword reader takes over. The quote is labelled "Offline reader" so nobody mistakes it for the AI.

## Run it

Needs Node 20+. No dependencies.

```bash
cp .env.example .env    # fill in the sandbox app, payee emails, webhook id, Gemini key
node app/server.mjs     # http://localhost:5175
```

For webhooks on a laptop, expose the port and register the URL once:

```bash
cloudflared tunnel --url http://localhost:5175
# put https://<random>.trycloudflare.com/webhooks/paypal in spike/.env WEBHOOK_URL, then:
node spike/spike.mjs webhook-setup
```

### Deploy on Render

`render.yaml` is a Render Blueprint. In Render: **New → Blueprint**, pick this repository, and fill in the values it asks for (the same as `.env`). Then register a webhook for the deployed URL and paste its id into `PAYPAL_WEBHOOK_ID` on Render:

```bash
PAYPAL_WEBHOOK_ID= WEBHOOK_URL=https://<service>.onrender.com/webhooks/paypal node spike/spike.mjs webhook-setup
```

Then open **Works → Spring launch poster → Open the brand request page**, pick an example request, get the quote, and pay with a sandbox **personal** account.

## Project layout

```
app/server.mjs          HTTP server: API, static files, PayPal return/cancel, webhook, live stream (SSE)
app/lib/ai.mjs          Gemini reading + guardrails + offline reader
app/lib/ratecard.mjs    sample works, rate cards, pricing engine
app/lib/licenses.mjs    checkout, capture, webhook state machine, Payouts
app/lib/paypal.mjs      sandbox client (OAuth, logged calls, webhook verification)
app/public/             the interface (vanilla HTML/CSS/JS), explain mode in explain.js
app/seed/demo.json      recorded real runs (Gemini readings, one sandbox payment) loaded into an empty store
spike/                  the first sandbox spike that proved each PayPal step
```

## What is honest to say

- Proven in the sandbox: itemised orders, capture, multi-payee checkout paying three accounts directly, Payouts 70/20/10, signature-verified webhooks driving the license state.
- Live multi-payee checkout and live Payouts may need PayPal partner onboarding and approval. Paying collaborators directly (split mode) avoids holding their money in a platform balance.
- The license page summarises what was granted. It is not legal advice.
