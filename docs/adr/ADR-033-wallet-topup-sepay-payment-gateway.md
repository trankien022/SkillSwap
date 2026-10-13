# ADR-033 — Wallet top-up settles through the SePay Payment Gateway

**Status:** Accepted. Supersedes part of [ADR-017](ADR-017-wallet-topup-mock-gateway.md) §1 (see *Relationship to ADR-017*).
**Date:** 2026-10-14
**Level:** Software (C4 Level 3 · Component)

**Context.** [ADR-017](ADR-017-wallet-topup-mock-gateway.md) shipped FR-008 behind a `PaymentGateway` port backed by a development/mock adapter and deferred vendor selection (its §1, "Gateway is a port, not a vendor"). That deferral was always meant to end. OQ-011 in the SRS still reads "mock gateway, vendor deferred", and the mock cannot demonstrate a real top-up, which the midterm requires. FR-008 is therefore re-opened for one decision only: **which product, and how does a real payment credit the ledger exactly once.**

The wallet's own write path is not in question and is not revisited here: idempotency keyed on `top_up_intents.status` plus a unique `(provider, provider_ref)`, the offsetting-debit reversal, the materialised `wallets.available_credits`, and the deficit rule all remain as ADR-017 §3–§5 decided them.

Two constraints shape the answer. Money is integer VND and 1 credit = 1,000 VND, never floats, so a provider amount must be proven integral and equal to the intent before crediting. And the inbound path must be *authenticated*: ADR-017 assumed a signed body, but that assumption turned out to describe a different SePay product (below).

**Decision.**

1. **The product is the SePay Payment Gateway** (hosted checkout plus IPN), replacing the mock adapter behind the unchanged `PaymentGateway` port. The rejected alternative — SePay's bank-transfer **QR + transaction-webhook** product — is recorded so it is not re-litigated: it is a lower-level product (static/dynamic VietQR plus a balance-change webhook) that yields no merchant-hosted checkout URL, so it cannot satisfy `initiateTopUp → { paymentUrl }`. An earlier draft of the FR-008 plan was built on it by mistake; the confusion is exactly why this ADR names the product in its title.

2. **One adapter serves Sandbox and Production; only configuration differs.** `SepayPaymentGateway` reads `sepayCheckoutHost` and `sepayRestBaseUrl` from config and contains no environment branch: `SEPAY_ENVIRONMENT` is a value, not a decision point.

3. **Checkout is a form POST, and the API performs it (design B).** SePay exposes no "create payment" REST call: `POST {checkoutHost}/v1/checkout/init` is a form submission that answers `302` to the hosted page. Design A (return the signed field set and have the client submit the form) was considered and rejected, because it would push signing material into the client and force a WebView on mobile. Under design B the adapter submits the signed form itself, does **not** follow the redirect, and returns the captured `Location` as `paymentUrl`. The port is unchanged, so every caller still just opens a link. A response that is not a redirect throws rather than returning a URL that would strand the payer.

4. **`provider_ref` becomes the SePay `order_invoice_number`,** replacing `randomUUID()`. It is the IPN's only correlation key, so it is generated in the domain layer as `SS-<epoch>-<6 hex>` and made unique by the existing `(provider, provider_ref)` constraint plus a bounded insert retry.

5. **Outbound signing is replicated in-repo and pinned by test.** SePay signs the permitted form fields joined in a **fixed order** as `k=v,…`, then `base64(hmac_sha256(string, secretKey))`. The field order is contract-sensitive and therefore pinned in a unit test rather than left to the call site. `payment_method` is omitted so SePay renders its own method picker. The vendor SDK is deliberately not taken as a dependency: the algorithm is ~15 lines and a pinned test is worth more than an opaque transitive dependency in the payment path.

6. **Inbound authentication is an IP allow-list plus the invoice lookup — not a signature and not a header.** This is the decision that most directly contradicts ADR-017 and it is made from observed behaviour, not from documentation. On live Sandbox deliveries the IPN carried **no `X-Secret-Key` header and no `User-Agent`**. A check on either would therefore reject *every genuine call*, so the shared-secret HMAC verifier, `PAYMENT_WEBHOOK_SECRET` and the old `webhook-signature` code are **removed** rather than left in place looking protective. SePay's source addresses are matched against the published allow-list, and authenticity is closed by the invoice lookup: an unauthenticated caller cannot invent an existing invoice number, and a replay of a real one is absorbed by idempotency (§7). Authentication is by IP allow-list at the edge; the app must not be exposed without it.

7. **Idempotency is owned by the use case, not the receiver.** SePay may retry, and replays must be free of effect: `top_up_intents.status` plus the unique `provider_ref` decide whether a callback applies anything. The receiver's only job is translation, so a replay, an unknown invoice, or a malformed-but-recognisable notification all end the same way.

8. **The route is repurposed in place, not duplicated.** `POST /wallet/top-ups/callback` keeps its path and now takes a SePay IPN, answering exactly HTTP 200 `{"success": true}` — the body SePay treats as acknowledged. Every *recognised* notification is acknowledged even when it applies nothing, so SePay is never told to retry something we would never act on; only a body that cannot be parsed at all is rejected. Recognised means: `ORDER_PAID` **and** `PAYMENT_SUCCESS` both credit (§*Observed divergences*), `TRANSACTION_VOID` reverses, and `order_amount` must equal the intent's `amountVnd` — a mismatch is acknowledged and left `pending`, logged, never credited.

9. **The `success_url` browser GET is tolerated.** Completing a checkout also fires a plain `GET` on the callback path from the payer's browser. It carries no IPN and credits nothing; the route answers it with the same ack.

10. **Reconciliation is deferred, with the gap stated.** A sweeper stub exists but is **disabled by default** (`SEPAY_RECON_ENABLED=false`). It is explicitly *not* production reconciliation: there is no backfill for an outage longer than the retry window and no manual-resolution workflow. Production cannot ship on this stub.

**Observed divergences from the documentation.** The implementation follows what Sandbox actually sends, which differs from the published contract in ways that would each have caused a silent failure:

| Fact | Documented | Observed on Sandbox |
|---|---|---|
| Successful-payment `notification_type` | `ORDER_PAID` | **both `ORDER_PAID` and `PAYMENT_SUCCESS`** are emitted — the receiver must accept both |
| `X-Secret-Key` header | present when auth type = `SECRET_KEY` | **absent** on both deliveries |
| `User-Agent` | — | **absent** |
| `order.order_amount` type | string (`"50000.00"`) | **inconsistent**: `"10000.00"` (string) vs `50000` (number) |
| `transaction.transaction_amount` type | string | **inconsistent**: `"10000"` vs `50000` |
| `custom_data` | array | `[]` **or an object** |
| `customer`, `agreement` | objects | **can be `null`** |
| IPN source IP | published allow-list | `171.244.35.2` (IPv4) and `2600:3c15::…` (IPv6), both on the list |

Translation of these quirks lives in the **inbound web adapter**, because the provider's wire format is an HTTP concern and the application layer should not know that an amount may arrive as a string with a fractional part.

**Relationship to ADR-017.** ADR-017 is append-mostly and is **not edited**. Its §1 vendor deferral is superseded by §1–§3 above: a vendor is now selected and the mock adapter is gone. Its §3 (idempotent intents), §4 (offsetting-debit reversal, deficit state) and §5 (materialised balance) remain **in force and unchanged** — this ADR builds on them. Its §2 (HMAC-over-raw-body) is superseded by §6 above, for the reason given there. References to ADR-017 in code should be read as pointing at the parts still live.

**Consequences.**

- (+) FR-008 is a real payment path: a sandbox checkout credits the wallet, and OQ-011 is genuinely resolved rather than deferred.
- (+) No mock anywhere in the shipped path, so a green test now means the real contract was exercised.
- (+) Sandbox → Production is a configuration change, not a code change; the same adapter and the same tests cover both.
- (−) **The app must run behind an IP allow-list.** Removed the signature check means an unauthenticated, un-proxied deployment would accept forged IPNs. This is the single largest operational obligation this ADR creates.
- (−) The invoice lookup is the only correlation key, so an invoice number must never be guessable or reused; both are enforced but are load-bearing.
- (−) Reconciliation is a documented stub. A payment that succeeds while the process is down will not self-heal; a human must reconcile from the SePay dashboard until Phase 8's full version exists.
- (−) Local development now depends on a public HTTPS tunnel and a reserved ngrok domain, so the dev stack has a new external dependency that CI does not exercise.

**Alternatives considered.**

- *SePay bank-transfer QR + transaction webhook* — rejected: no hosted checkout URL, so it cannot satisfy the port (see §1).
- *Design A, client submits the signed form* — rejected: signing material reaches the client and mobile needs a WebView (see §3).
- *Keep the HMAC verifier and enable `X-Secret-Key` in the dashboard* — rejected as the default: it would make the shipped path depend on a dashboard setting that is off by default, and would still leave `User-Agent`-based checks broken. Available as opt-in hardening, not as the contract.
- *Take the official `sepay-pg-node` SDK* — rejected: an opaque dependency in the payment path for ~15 lines, where a pinned test of the signing order is the better guarantee.
- *Add a second callback route for SePay* — rejected: the path is already public and already means "the provider says a top-up happened"; a second route would split that meaning.

**Verification.**

- Unit: signature vector pinned against a hand-computed value; invoice-number format, alphabet and 10k-sample uniqueness; collision retry.
- Unit (adapter): both `ORDER_PAID` and `PAYMENT_SUCCESS` credit; `TRANSACTION_VOID` reverses; string and numeric amounts parse identically; unknown invoice and replayed IPN are acknowledged with no state change; amount mismatch is acknowledged and left pending; a non-redirecting checkout response throws.
- Integration: the e2e specs post a real SePay IPN body and assert via `walletRow`; `pnpm test:arch` stays green (the payment adapter imports no HTTP framework into `domain/` or `application/`).
- Manual: a Sandbox checkout completes, the IPN arrives through the tunnel, and the balance rises exactly once.
- **Not yet verified:** nothing in the suite exercises a live SePay call in CI. Sandbox reachability was proven by hand (Phase 0) and by a live IPN capture, not by an automated test. Production is unexercised.

**Related:** [ADR-017](ADR-017-wallet-topup-mock-gateway.md) (superseded in part), [ADR-013](ADR-013-message-broker-rabbitmq.md) (outbox), [ADR-014](ADR-014-persistence-typeorm.md) (persistence), [ADR-022](ADR-022-wallet-read-model.md) (wallet read side).
**Plan:** `docs/plans/2026-10-13-fr008-sepay-payment-gateway-plan.md` (phased plan and Phase 0 findings).
