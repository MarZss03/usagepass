# RightsRail sandbox spike

Checks, against the PayPal sandbox, the money movements RightsRail depends on, and the webhook that turns a payment into an active license.

| Step | PayPal API | What it proves | Sandbox result (2026-11-07) |
|---|---|---|---|
| 1 | Orders v2 (`POST /v2/checkout/orders`, `/capture`) | A $310 license with itemised rights is bought by a sandbox buyer and captured | Passed: captured, net $300.71 |
| 2 | Webhooks (`/v1/notifications/webhooks`, `verify-webhook-signature`) | PayPal delivers `PAYMENT.CAPTURE.COMPLETED` to `receiver.mjs`, which verifies the signature and flips the license to `ACTIVE` | Passed (2026-11-08): PayPal delivered `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, three `PAYOUTS-ITEM.SUCCEEDED` and `PAYOUTSBATCH.SUCCESS` through a tunnel; all signatures verified; license went `PENDING` → `ACTIVE` with payouts recorded |
| 3 | Payouts (`POST /v1/payments/payouts`) | The net amount is split 70/20/10 and paid to three collaborators by email | Passed: $210.50 / $60.14 / $30.07, all `SUCCESS` |
| 4 | Orders v2, multiple `purchase_units` with `payee` | One checkout pays three collaborators directly, with no platform balance in between | Passed: $217 / $62 / $31 captured to three personal sandbox accounts |

No dependencies. Needs Node 18+ (uses built-in `fetch`).

## Files

- `spike.mjs`: the command-line spike (orders, capture, payouts, webhook setup).
- `receiver.mjs`: the webhook receiver. Only signature-verified events change license state.
- `paypal.mjs`: the shared sandbox client (`.env`, OAuth, logged API calls).

## Setup

1. Sign in at https://developer.paypal.com, open **Apps & Credentials**, make sure the toggle says **Sandbox**, and create an app (type: Merchant). Copy its Client ID and Secret.
2. In the app's settings, make sure **Payouts** is ticked under features.
3. Open **Testing Tools → Sandbox Accounts**. Create three more accounts (Personal is fine) for the collaborators. The buyer is the default personal account.
4. `cp .env.example .env` and fill in the Client ID, Secret and the three collaborator emails.

### Webhook receiver

PayPal only sends events to a public https URL, so the receiver needs one.

**Option A, a tunnel to your machine** (fastest to iterate):

```bash
node receiver.mjs
cloudflared tunnel --url http://localhost:5175
```

Put `https://<random>.trycloudflare.com/webhooks/paypal` in `WEBHOOK_URL` and `http://localhost:5175` in `RECEIVER_URL`. Quick-tunnel URLs change on every start, so re-run `webhook-setup` each time.

**Option B, Render** (a stable URL for the demo): create a Blueprint from this repo's `render.yaml`, then set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` and (after the next step) `PAYPAL_WEBHOOK_ID` in the Render dashboard. Put `https://<service>.onrender.com/webhooks/paypal` in your local `WEBHOOK_URL`.

Then register the webhook, which creates it or updates its URL and event types:

```bash
node spike.mjs webhook-setup
```

Copy the printed `PAYPAL_WEBHOOK_ID` into `.env` (and into Render, for option B), then restart the receiver.

## Run

```bash
node spike.mjs doctor   # credentials, scopes, payee emails, webhook subscription, receiver reachable
node spike.mjs run      # order → buyer approval → capture → receiver shows ACTIVE → payouts
node spike.mjs split    # multi-payee order; ACTIVE only after all three shares are captured
```

After approving on PayPal you land on `http://localhost:5174/return`, and the script continues. It also polls the order, so it works even if that page does not load. Open the receiver's `/` page to watch the license change state.

Single steps: `order`, `capture <orderId>`, `payout <captureId>`, `webhook-events <captureId>`, `license <licenseId>`.

Every request and response is written to `logs/`, along with PayPal's `paypal-debug-id`. Received events are logged too. Secrets and access tokens never are.

## License states

| Event | License |
|---|---|
| `CHECKOUT.ORDER.APPROVED` | `PENDING` |
| `PAYMENT.CAPTURE.COMPLETED` | `ACTIVE` once every purchase unit of the order is captured (`PARTIALLY_PAID` before that) |
| `PAYMENT.CAPTURE.PENDING` | `PAYMENT_HELD`: PayPal is holding the funds, so the work may not be used yet |
| `PAYMENT.CAPTURE.DENIED` | `DENIED` |
| `PAYMENT.CAPTURE.REFUNDED` / `REVERSED` | `REVOKED`, which is final: a refund or chargeback ends the right to use the work |
| `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` / `FAILED` | Each collaborator's payout status, recorded on the license |

The receiver sends PayPal the event exactly as it received it, byte for byte, because re-serialised JSON can fail verification. Duplicate deliveries are acknowledged but not applied twice. Events are applied one at a time, so concurrent captures of a multi-payee order cannot race. `ALLOW_UNVERIFIED=1` skips verification for local tests only.

## What is still unknown

- Refund, reversal, pending and denied events have only been tested with replayed payloads, not real PayPal deliveries.
- The multi-payee checkout worked in the sandbox with personal accounts as payees. Whether live accounts can do the same without PayPal's multiparty (partner) onboarding is unverified.
- Live Payouts need PayPal approval, and paying others out of a platform balance raises a money-transmission question. Step 4 avoids that balance, so it is the better production path. This spike only covers the sandbox.
