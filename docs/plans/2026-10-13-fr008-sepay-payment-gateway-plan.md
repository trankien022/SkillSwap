# FR-008 — Real wallet top-up via **SePay Payment Gateway** (plan)

> Date: **2026-10-13** · Branch: `feat/fr-008-sepay-payment-gateway`
> Supersedes: FR-008 mock-gateway half of [ADR-017](../adr/ADR-017-wallet-topup-mock-gateway.md) §1
> Correction: an earlier draft of this file planned **SePay QR + bank webhook**. That is the
> **wrong product** and has been replaced — this plan targets the **SePay Payment Gateway**
> (hosted checkout + IPN), which is what the existing `PaymentGateway` port already models.
> Scope: **FR-008 / API-006 / AC-009 only.** FR-014 (teacher payout) stays open.

## 1. Product choice (corrected)

Use **SePay Payment Gateway** — the hosted checkout product. `POST /v1/checkout/init` takes a
signed HTML form and returns a **302 to a real hosted payment page** (`GET /v1/checkout`).
SePay then calls our **IPN** endpoint with the order result. This is a genuine
`initiateTopUp → { paymentUrl }` gateway: `paymentUrl` is a merchant-hosted checkout URL, not a
static QR image, so **no UI change is required to render it as a link**.

Rejected alternative (recorded so it is not re-litigated): the **bank-transfer QR + transaction
webhook** product. It is a different, lower-level product (static/dynamic VietQR plus a
balance-change webhook) and does not produce a hosted checkout URL. The prior draft was built on
it by mistake.

## 2. Goal

Replace the mock payment gateway with **SePay Payment Gateway** so a real (sandbox-simulated, then
Production) checkout credits the wallet exactly once, driven end to end locally through an
**ngrok** tunnel with **no mock anywhere in the path**. One adapter serves **Sandbox** and
**Production**; only configuration differs.

## 3. What is actually being asked (falsifiable)

| # | Claim to satisfy | How it is proven |
|---|---|---|
| G1 | `POST /wallet/top-ups` returns a **hosted SePay checkout URL** | `paymentUrl` starts with `https://pay-sandbox.sepay.vn/v1/checkout?...` (or `pay.sepay.vn` in production) |
| G2 | Paying on the SePay page drives an **IPN** that credits exactly once | Complete a Sandbox test payment → IPN hits `/api/wallet/top-ups/callback` → `{"success":true}` → balance rises by the intent's credits |
| G3 | Replays never double-credit | Replay the IPN body → already-processed, same balance |
| G4 | A **void** transaction reverses the credit | `TRANSACTION_VOID` IPN posts an offsetting debit |
| G5 | Amount / order mismatches never credit wrongly | IPN `order_amount` must equal the intent's `amountVnd`; unknown invoice → 200 ack, no change |
| G6 | Teammates use the **same ngrok URL every run** | One reserved free dev domain in the committed `ngrok.yml`; SePay's IPN URL is configured once |
| G7 | `pnpm dev` starts ngrok **in parallel** with the containers, token from `.env`, and **requires installation** if absent | New `ngrok` script + preflight; `pnpm dev` fans out to it |
| G8 | Sandbox and Production share one adapter | `SepayPaymentGateway` reads config only; environment is a value, not a branch |

## 4. Assumptions (call out if wrong before Phase 1)

- A1. **Sandbox credentials are obtainable now** (register at my.sepay.vn → Payment Gateway → Sandbox). No Production approval is needed for the demo.
- A2. **Checkout form is built server-side** and submitted by the browser; our API returns the generated checkout URL to the client. (See §5 for why we choose form-POST over a REST `checkout/init` call.)
- A3. Demo amounts are small and integral (whole credits), e.g. 50,000 VND.
- A4. The committed dev domain never rotates; if it ever changes, one committed line and one SePay field change.
- A5. Our IPN handler can return `200 {"success": true}` and SePay treats that as acknowledged.
- A6. Sandbox IPN fires just like Production (documented: "Your IPN and Callback URLs still fire as in Production").

## 5. Key contract facts (from the official docs, verified)

**Checkout (payment form)**

| | Sandbox | Production |
|---|---|---|
| Checkout form action | `https://pay-sandbox.sepay.vn/v1/checkout/init` | `https://pay.sepay.vn/v1/checkout/init` |
| REST API base (orders/transactions) | `https://pgapi-sandbox.sepay.vn` | `https://pgapi.sepay.vn` |
| Auth (REST only) | `Authorization: Basic base64(merchant_id:secret_key)` | same |

**Form fields (signature order is fixed):** `order_amount`, `merchant`, `currency`, `operation`,
`order_description`, `order_invoice_number`, `customer_id`, `payment_method`, `success_url`,
`error_url`, `cancel_url`, then `signature`.

**Signature:** filter to the allowed fields in that order, join as
`field1=value1,field2=value2,…`, then
`signature = base64(hmac_sha256(signedString, secret_key, rawBinary))`.
(The earlier draft assumed `{timestamp}.{rawBody}` hex — that is the **webhook** product's scheme, not this one.)

**Creation flow:** submit the form to `checkout/init` → SePay returns **302** whose `Location` is
`GET /v1/checkout?…` carrying our fields plus `order_id`, `transaction_id`, `branch_code`,
`branch_terminal_code`, `timestamp` and a re-signed `signature`.

**IPN (our callback route):**
- `POST` to the URL configured at **Payment Gateway → Configuration → IPN** (my.sepay.vn).
- Headers: `X-Secret-Key: <secret_key>` (present when auth type = `SECRET_KEY`),
  `Content-Type: application/json`.
- Body: `{ timestamp, notification_type, order{…}, transaction{…}, customer{…} }` where
  `notification_type ∈ {ORDER_PAID, TRANSACTION_VOID}`.
  - `order.order_invoice_number` is our correlation key.
  - `order.order_amount` is a **string** in the smallest unit (e.g. `"50000.00"`).
  - `transaction.transaction_status` e.g. `APPROVED`, `transaction_type` e.g. `PAYMENT`.
- Respond **HTTP 200** (`{"success": true}`) to acknowledge.
- IPN URL must be **public HTTPS** (no localhost / internal IP) → **ngrok** for local dev, exactly as documented by SePay.

### Design consequence: form-POST, not a REST call

`checkout/init` is **form submission, not an API endpoint**. There are two viable shapes:

- **(chosen) A — the API builds and returns the signed checkout URL + fields**, and our web/mobile client POSTs the form. Keeps `PaymentGateway.initiateTopUp → { paymentUrl }` intact; the client renders a form (web) or opens a hosted link (mobile).
- **B — the API acts as a proxy**, POSTing the form itself and capturing the 302 `Location`, returning that as `paymentUrl`. Simpler client, but the API makes an outbound HTTP call that follows a redirect, and the checkout page then re-serves content it did not originate. Acceptable fallback if A proves awkward on mobile.

This plan implements **A**, with **B** documented as the fallback.

## 5a. Phase 0 findings — verified against live Sandbox (2026-10-14)

The spike passed: a signed form returned `302` → hosted `/v1/checkout`, and a completed
Sandbox payment delivered a real IPN to the ngrok tunnel. Observed facts that override the docs:

| Fact | Doc says | Observed |
|---|---|---|
| Successful-payment `notification_type` | `ORDER_PAID` | **Both `ORDER_PAID` and `PAYMENT_SUCCESS` are emitted** (live checkout used `ORDER_PAID`; the integration-guide test send used `PAYMENT_SUCCESS`). The receiver MUST accept both. |
| `X-Secret-Key` header | present when auth type = `SECRET_KEY` | **Absent on both deliveries** — not enabled by default. Do not require it; verify via IP allow-list and/or enable the header in the dashboard. |
| `order.order_amount` type | string (`"50000.00"`) | **Inconsistent**: live = `"10000.00"` (string), test send = `50000` (number). Parser must accept both. |
| `transaction.transaction_amount` type | string | **Inconsistent**: `"10000"` vs `50000`. Accept both. |
| `order.order_status` | — | `CAPTURED` for a paid order. |
| `custom_data` | array | `[]` **or an object** — never assume a shape. |
| `customer`, `agreement` | objects | **Can be `null`.** |
| IPN source IPv4/IPv6 | published allow-list | `171.244.35.2` and `2600:3c15::2000:8aff:fedd:874b` — both on SePay's published list. |
| Browser follow-up | — | The `success_url` also triggers a browser **`GET`** to the callback URL; the route must tolerate a GET (no credit) and only credit on the signed POST. |
| Checkout `302` echoes | `order_id, transaction_id, branch_code, timestamp, signature` | Confirmed, plus `trace_id` and `choose_payment_method=0`. |

Structural note: SePay's IPN POST has **no `User-Agent` and no `X-Secret-Key`** — so an auth
check based on either would reject every genuine call. Prefer the IP allow-list plus invoice
lookup; treat the secret-header check as opt-in.

## 6. Target design

```
Web/Mobile                 Gateway :4000          API :4001                        SePay PG
   │ POST /wallet/top-ups      │                     │                                │
   ├──────────────────────────►├────────────────────►│ intent(providerRef=invoice)    │
   │                           │                     │ sign checkout fields           │
   │  {providerRef, paymentUrl,│◄────────────────────┤ paymentUrl = pay-…/v1/checkout │
   │   checkoutFields}         │                     │                                │
   │◄──────────────────────────┤                     │                                │
   │ POST form → checkout/init ──────────────────────┼───────────────────────────────►│
   │◄──── 302 → hosted /v1/checkout (user pays) ─────┼────────────────────────────────┤
   │                           │                     │◄── POST IPN (X-Secret-Key) ─────┤
   │                           │                     │ verify secret                  │
   │                           │                     │ find intent by invoice number  │
   │                           │                     │ assert order_amount == amountVnd│
   │                           │                     │ applyTopUp / reverse (idempotent)│
   │                           │                     │ 200 {"success":true} ──────────►│
   │◄── success_url / polling ─┼─────────────────────┤                                │
```

- **Adapter swap only.** `SepayPaymentGateway implements PaymentGateway`; the application layer is untouched.
- **`providerRef` becomes the invoice number.** `InitiateTopUpUseCase` stops using `randomUUID()` and instead produces a unique `order_invoice_number` (see §7.1). It is the IPN correlation key.
- **Callback route repurposed in place**: `POST /api/wallet/top-ups/callback` — same path, SePay IPN contract. `{applied,status}` → `{"success":true}`. No second route.
- **Money unchanged**: IPN `order_amount` (string) → integer VND → existing `vndToCredits` → `amountCredits`.

## 7. Decisions locked by this plan

### 7.1 Invoice number (replaces `randomUUID`)
- Format: `SSWAP-<8-char base32>` from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0/O/1/I`), e.g. `SSWAP-K7F2QX9M`.
- Must be **unique, not duplicated** (SePay requirement). Uniqueness enforced by the existing `UNIQUE(provider, provider_ref)` plus a bounded insert retry.
- `top_up_intents.provider_ref` continues to store it, so no lookup-column rename is strictly required; an explicit `invoice_number` alias in the domain keeps intent clear.

### 7.2 Outbound signature (checkout form)
Exactly the §5 algorithm: allowed fields in fixed order → `k=v` comma-joined → HMAC-SHA256 → base64.
`payment_method` is omitted so SePay shows its method picker (or is set to `BANK_TRANSFER` if we want to force the QR path in the demo).

### 7.3 Inbound IPN contract
- Verify `X-Secret-Key === SEPAY_SECRET_KEY` (constant-time compare) when auth type is `SECRET_KEY`. Optionally also verify SePay source IP against the published allow-list (defense in depth).
- `notification_type === 'ORDER_PAID'` → credit.
- `notification_type === 'TRANSACTION_VOID'` → reverse (offsetting debit), reusing the existing reversal path.
- Unknown `order_invoice_number` → 200 ack, no state change, no crash.
- `order_amount` (string, e.g. `"50000.00"`) MUST parse to exactly the intent's `amountVnd`; mismatch → 200 ack, leave `pending`, log.
- Idempotency owned by the use case (`top_up_intents.status` + unique `provider_ref`), not the IPN alone — SePay may retry.
- Always answer **200 `{"success": true}`** for recognised protocol shapes, so SePay does not retry into a loop.

### 7.4 Environment
`SEPAY_ENVIRONMENT = sandbox | production` selects the checkout host + REST base. Values differ only; no logic branches. Same `SepayPaymentGateway` class for both.

## 8. Non-goals

- FR-014 teacher **payout** / withdrawal.
- **Full reconciliation** (Phase 8 is a disabled, documented stub only).
- Recurring/subscription flows, refund API (only `TRANSACTION_VOID` reversal), settlement reporting.
- Editing `ARCHITECTURE.md`. No cross-schema SQL. No float money.

## 9. Phases (each phase = one commit)

### Phase 0 — Spike: Sandbox checkout + IPN reachability (no commit)
- Goal: with a throwaway ngrok tunnel, confirm Sandbox `checkout/init` returns the 302 hosted page and that SePay fires IPN to the ngrok `/api/wallet/top-ups/callback` URL.
- Steps: get Sandbox `merchant_id`/`secret_key`; build a minimal signed form; submit; complete the Sandbox test payment; watch the ngrok request log for the IPN; note the real IPN body and headers (especially `X-Secret-Key` presence and `order_amount` format).
- Exit criteria: a real IPN arrives and is logged. **If Sandbox IPN cannot reach ngrok, stop and replan (R1).**
- Deliverable: notes appended to the runbook draft.

### Phase 1 — Contracts & config surface
- `packages/contracts/src/index.ts`: add `sepayIpnSchema`; extend `topUpIntentSchema` with the checkout payload the client needs (`paymentUrl` + `checkoutUrl` + `checkoutFields`), or keep `paymentUrl` only if we choose design B.
- `apps/api/src/shared/config/api-config.ts`: add `sepayEnvironment`, `sepayCheckoutHost`, `sepayRestBaseUrl`, `sepayMerchantId`, `sepaySecretKey`, `sepayReturnUrl` (success/error/cancel base). Merchant id/secret are **secrets** → `.env` only; hosts and return base are non-secret.
- **Verify**: `ApiConfig` unit test; contracts build.
- **Deliverable**: typecheck + contracts build green.

### Phase 2 — DB migration: invoice & payment bookkeeping
- New migration after `1791072000002`: add `paid_at timestamptz`, `paid_amount_vnd integer`, and (if useful) `sepay_order_id text` to `top_up_intents`; ensure an index for the invoice lookup.
- Register in the existing `data-source.ts`; do not hand-edit applied migrations.
- **Verify**: `pnpm db:migrate` on a clean schema; repository spec green.
- **Deliverable**: migration applied, existing rows untouched.

### Phase 3 — SePay checkout adapter + invoice generator
- New: `.../adapter/out/payment/sepay-payment-gateway.ts` (`provider = 'sepay'`), returning the signed checkout URL/fields from `providerRef` + `amountVnd`.
- New: `.../domain/checkout-signature.ts` — pure function implementing §7.2 (unit-tested against a hand-computed vector).
- New: `.../domain/invoice-number.ts` — `generateInvoiceNumber(): string` + `isInvoiceNumber(value)`.
- Changed: `initiate-top-up.use-case.ts` (invoice instead of UUID; retry on collision); `wallet-ledger.module.ts` (bind SePay adapter from config); `testing/fakes.ts` (`FakePaymentGateway.provider = 'sepay'`, real URL shape).
- **Verify**: adapter URL/fields shape, signature vector, invoice alphabet/length/uniqueness (10k samples), collision retry; `pnpm test:arch` green.
- **Deliverable**: `POST /wallet/top-ups` returns a real Sandbox checkout URL.

### Phase 4 — IPN receiver + callback route (repurpose in place)
- Replace `webhook-signature.ts` / `hmac-webhook-signature-verifier.ts` with a **secret-key header check** for the IPN (the HMAC-over-body scheme belongs to the other product).
- `handle-top-up-callback.use-case.ts`: implement §7.3 (ORDER_PAID credit, TRANSACTION_VOID reverse, amount assert, unknown invoice ack, idempotent replay).
- `handle-top-up-callback.ts` port: input becomes the IPN payload; result is internal-only.
- `wallet.controller.ts`: callback returns `@RawResponse()` + `{success:true}`; reads `X-Secret-Key`.
- `wallet.dto.ts`: `TopUpCallbackDto` → `sepayIpnSchema`.
- Keep the public-path entries (`trusted-identity.guard.ts`, gateway `PUBLIC_PATHS`) — path unchanged.
- **Verify**: unit tests (paid, void, duplicate, amount mismatch, unknown invoice, bad secret) + an integration test POSTing a real IPN body.
- **Deliverable**: IPN credits once and reverses on void.

### Phase 5 — ngrok tunnel: config, env, `pnpm dev` parallel start
- `ngrok.yml` (committed, **no secrets**): endpoint `api` → `addr: 4001`, `domain: <reserved-dev-domain>.ngrok-free.app`.
- Token never in the repo: lives in the global ngrok config (`ngrok config add-authtoken`) or `NGROK_AUTHTOKEN` in `.env`. Note ngrok does **not** expand `${VAR}` inside `ngrok.yml`, so the repo file carries **no authtoken line**; the token is merged in from the global config via `--config` (later overrides earlier).
- `.env.example` (non-secret): `NGROK_DOMAIN=`, `SEPAY_ENVIRONMENT=sandbox`, `SEPAY_CHECKOUT_HOST=`, `SEPAY_REST_BASE_URL=`, `SEPAY_RETURN_URL=`.
- `.env` (secret): `SEPAY_MERCHANT_ID`, `SEPAY_SECRET_KEY`, `NGROK_AUTHTOKEN`.
- `scripts/dev-ngrok.mjs`: preflight `ngrok --version`; if missing exit non-zero with per-OS install instructions (Windows `winget install ngrok.ngrok` / `choco install ngrok`; macOS `brew install ngrok`; plus the download link). Load `NGROK_AUTHTOKEN` from `.env`; if empty, print `ngrok config add-authtoken …`. Then run `ngrok http --config <home-config> --config <repo>/ngrok.yml api` and print the public URL.
- `scripts/dev.mjs` (new): spawn `pnpm -r --parallel dev` **and** `node scripts/dev-ngrok.mjs` together, forward signals. Root `dev` calls it; extend `scripts/dev-stop.mjs` to kill the ngrok tree too.
- **Verify**: `pnpm dev` prints the tunnel URL; without ngrok it fails with the install message; `.env` remains git-ignored.
- **Deliverable**: containers + apps + tunnel in one command.

### Phase 6 — Remove the mock
- Delete `mock-payment-gateway.ts`, `scripts/mock-topup-callback.mjs`, `apps/web/src/app/[locale]/wallet/actions.ts` (`simulatePaymentCallback`) and its two call sites (`wallet/page.tsx`, `classes/[id]/checkout/page.tsx`).
- Upgrade `apps/api/test/booking-flow.e2e-spec.ts` and `apps/api/test/jitsi.e2e-spec.ts` to post a **SePay-shaped IPN** (secret-key header) and assert via `walletRow`.
- Keep `FakePaymentGateway` as a unit double, pointed at the real URL shape.
- **Verify**: `grep -ri mock apps/api/src apps/web/src scripts` shows no payment mock; `pnpm verify` and `pnpm test:e2e` green.
- **Deliverable**: zero mock payment paths.

### Phase 7 — Web + Mobile UI
- Web `wallet/page.tsx`: replace the placeholder QR + fake bank toggle with a real "Pay now" action that submits the SePay checkout form (design A) and then polls a new `GET /wallet/top-ups/:id` until `settled`, refetching balance/history. Remove `simulatePaymentCallback`.
- Web `classes/[id]/checkout/page.tsx`: the top-up modal does the same real flow.
- Mobile `wallet-view.tsx` + `wallet-service.ts`: open the SePay checkout URL (or render the form action), then poll the intent status.
- New API read endpoint `GET /api/wallet/top-ups/:id` (owner-scoped, authenticated) for the poll.
- `apps/mobile/src/infrastructure/http/api-evidence.ts`: allowlist `/^\/wallet\/top-ups\/[^/]+$/` (callback stays excluded).
- **Verify**: web component test (submits form / polls until settled); mobile test (opens URL / polls).
- **Deliverable**: UI drives a real SePay checkout end to end.

### Phase 8 — Reconciliation stub (explicitly incomplete)
- `.../adapter/in/scheduler/topup-reconciliation.sweeper.ts`, **disabled by default** (`SEPAY_RECON_ENABLED=false`): queries the SePay REST API for orders stuck `pending` older than N minutes and matches by invoice number.
- Documented in the ADR as **not** the production reconciliation (no >5h outage backfill, no manual-resolution workflow). Production cannot ship without the full version.
- **Verify**: unit test with a faked SePay client; scheduler off in dev/test.
- **Deliverable**: documented, disabled skeleton + ADR risk note.

### Phase 9 — Docs, diagrams, runbook
- New ADR `docs/adr/ADR-030-wallet-topup-sepay-payment-gateway.md`: supersede ADR-017 §1; resolve OQ-011 to SePay Payment Gateway; record the rejected QR+webhook alternative, design A vs B, amount validation, idempotency, void reversal, reconciliation-deferred-with-risk, sandbox vs production table.
- `docs/plans/2026-09-15-001-…-requirements-plan.md`: update the OQ-011 row (currently "mock gateway").
- `docs/api/wallet.md` + `docs/api/FRONTEND-API-GUIDE.md`: regenerate (`pnpm docs:api`) and fix the hand-written callback row.
- `docs/diagrams/checkpoint/source/sequence-topup.puml`: "Simulated payment provider" → SePay Payment Gateway; re-render.
- `docs/diagrams/c4/source/workspace.dsl` + the six `structurizr-*.puml`: external payment system → SePay Payment Gateway; re-render via the plantuml-skill `render.py` into `docs/diagrams/c4/generated`.
- `tasks/mobile-week6-evidence.md`: dated note that the mock callback is removed and superseded.
- New `docs/runbooks/sepay-ngrok-local-demo.md` (outline in §11).
- **Verify**: `pnpm verify` green; diagrams re-rendered (PNG+SVG newer than source).
- **Deliverable**: docs consistent with the shipped gateway.

## 10. `.env` / `.env.example` — exact lines

`.env.example` (non-secret, committed):
```dotenv
# ── FR-008 (ADR-030): SePay Payment Gateway ──
SEPAY_ENVIRONMENT=sandbox                 # sandbox | production
SEPAY_CHECKOUT_HOST=https://pay-sandbox.sepay.vn
SEPAY_REST_BASE_URL=https://pgapi-sandbox.sepay.vn
# Where SePay redirects the browser back to after checkout (must be public).
SEPAY_RETURN_URL=https://<dev-domain>.ngrok-free.app
# SEPAY_MERCHANT_ID=                      # secret — .env only, never here
# SEPAY_SECRET_KEY=                       # secret — .env only, never here
# SEPAY_RECON_ENABLED=false

# ── Local payment tunnel (ngrok) ──
NGROK_DOMAIN=                            # reserved free dev domain, e.g. ab12-34.ngrok-free.app
# NGROK_AUTHTOKEN=                       # secret — .env only, never here
```

`.env` (secret, NOT committed) additionally:
```dotenv
SEPAY_ENVIRONMENT=sandbox
SEPAY_MERCHANT_ID=<sandbox merchant id>
SEPAY_SECRET_KEY=<sandbox secret key>
SEPAY_RETURN_URL=https://<dev-domain>.ngrok-free.app
NGROK_AUTHTOKEN=<ngrok authtoken>
NGROK_DOMAIN=<dev-domain>.ngrok-free.app
```
Remove the now-unused `PAYMENT_WEBHOOK_SECRET` and its "ADR-017 mock" comment.

## 11. Runbook outline (`docs/runbooks/sepay-ngrok-local-demo.md`)

1. **Per teammate (once)**: install ngrok; `ngrok config add-authtoken <token>`; `cp .env.example .env` and fill `SEPAY_MERCHANT_ID`, `SEPAY_SECRET_KEY`, `NGROK_AUTHTOKEN`.
2. **Per team (once)**: reserve the free dev domain at dashboard.ngrok.com/domains; paste it into the committed `ngrok.yml` and the `.env.example` placeholder.
3. **In SePay (once)**: Payment Gateway → Configuration → **IPN** → set `https://<dev-domain>.ngrok-free.app/api/wallet/top-ups/callback`. Use **Sandbox** credentials first; duplicate for Production after go-live.
4. **Every run**: `pnpm dev` (containers + apps + ngrok in parallel; prints the URL).
5. **Demo**: sign in → wallet → pay → SePay hosted page → complete Sandbox test payment → wallet polls and credits.
6. **Troubleshooting**: invalid signature (field order / secret / environment), 401 on IPN (`X-Secret-Key` mismatch), no IPN (IPN URL saved? public HTTPS?), amount mismatch (ack-by-design), void reversal not applied (`TRANSACTION_VOID` handling).
7. **Sandbox vs Production table** (both use the same ngrok URL locally; Production only once a real merchant account is approved).

## 12. Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Sandbox IPN cannot reach the ngrok domain | Low | High | **Phase 0 gates the plan**; SePay docs explicitly recommend ngrok, so risk is low |
| R2 | Checkout form signature rejected (wrong field order / env secrets) | Medium | High | Pure-function signer with a hand-computed test vector; validate against Sandbox in Phase 0 before code lands |
| R3 | `order_amount` string format mis-parsed (`"50000.00"`) | Medium | Medium | Parse with an explicit decimal-to-integer helper; unit test the exact documented sample |
| R4 | Double credit on IPN retry | Medium | High | Idempotent use case keyed on invoice number + status; replay test |
| R5 | Production merchant approval takes time | Medium | Medium | Sandbox unblocks the demo; Production is config-only, not code |
| R6 | Removing the mock breaks e2e / midterm evidence | Medium | Medium | Phase 6 upgrades both e2e specs; Phase 9 annotates the evidence doc |
| R7 | Secret committed by accident | Low | High | `SEPAY_SECRET_KEY`, `SEPAY_MERCHANT_ID`, `NGROK_AUTHTOKEN` only in `.env` (git-ignored); `.env.example` carries placeholders |
| R8 | Free ngrok limits (requests/mo) | Low | Low | Only checkout redirects + IPNs traverse the tunnel in dev |

## 13. Definition of done (FR-008)

1. `pnpm verify` green; `pnpm test:e2e` green with the SePay-shaped IPN helper.
2. A Sandbox checkout credits the wallet exactly once; a replay does not; a void reverses.
3. `grep -ri mock apps/api/src apps/web/src scripts` shows no payment mock.
4. `pnpm dev` starts ngrok in parallel, prints the same URL each run, and fails loudly if ngrok is missing.
5. ADR-030 + runbook merged; diagrams re-rendered; `docs:api` regenerated.
6. No secret committed; `.env.example` has placeholders only.

## 14. Open questions before Phase 1

- OQ-A. Design **A** (client submits the signed form) vs **B** (API proxies and captures the 302)? — assumed **A**.
- OQ-B. Add `GET /wallet/top-ups/:id` so the client polls without a paid polling add-on? — assumed **yes**.
- OQ-C. Sandbox credentials available now, or is Production the only option? — assumed Sandbox available (docs say it is instant).
- OQ-D. Should `payment_method` be omitted (let the user pick) or forced to `BANK_TRANSFER` for the demo? — assumed **omitted**, showing SePay's method picker.
