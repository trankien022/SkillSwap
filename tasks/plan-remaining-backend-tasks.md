# Plan — the four remaining backend tasks (B8, B9, B11, B12)

Date: 2026-11-08
Source of truth: [`../../2026-11-07-backend-remaining-work.md`](../../2026-11-07-backend-remaining-work.md)
Base: `feat/backend-remaining-work-and-client-fixes` @ `2a6e27a`

## Scope decision

B1–B7 and B10 shipped in the previous batch. These are the four that were left, in the order
that respects their dependencies:

| Phase | Task | Commit |
|---|---|---|
| P0 | this plan | `docs: …` |
| P1 | **B12** — point the reconciliation reader at the endpoint SePay actually serves, and record what was verified | `fix(wallet-ledger): …` |
| P2 | **ADR-023 amendment** — presigned download, admin + verifier, 300 s, audited | `docs(adr): …` |
| P3 | **B8** — let an admin/verifier open the uploaded verification document | `feat(student-verification): …` |
| P4 | **B9** — accept certificate evidence with a document | `feat(skill-verification): …` |
| P5 | **B11** — announce refunds, income releases and reversals; audit a top-up | `feat(wallet-ledger): …` |

B12 goes first because it is a one-line defect with a documented-risk consequence; the ADR goes
before B8 because `AGENTS.md` forbids code that contradicts an ADR. B9's last sub-item (a verifier
opening the file) reuses B8's port, so B8 must land first.

## Decisions taken by the product owner (2026-11-08)

These were put as explicit choices and answered; they are not mine to invent:

1. **B8 access:** `admin` **and** `verifier` may mint a download URL; **300 s** TTL; every read
   writes an audit row with the caller's `actorId` (ADR-035).
2. **B11 audience:** **refund, income release and reversal** each raise an FR-016 notification;
   **top-up** gets an **audit row** rather than a notification, because the user initiated it.

## Invariants

- No cross-schema SQL and no cross-schema FK (ADR-014). The audit store lives in `admin_operation`,
  so `student-verification` reaches it through the **outbox**, which is how `verification.decision.*`
  and `skill_evidence.*` are already audited — not by a direct repository call.
- Money stays integer VND / integer credits. `amountCredits` on the event is a positive integer and
  `direction` carries the sign, as `booking_payment`/`booking_refund` already do.
- No new event schema beyond what `packages/contracts` defines. `wallet.transaction.completed`
  already carries `income_release` and `booking_refund`; only a **reversal** member is new, and it
  is a contract change that the runbook explicitly deferred to whoever first needs it.
- A presigned URL is **never persisted, never logged, never listed**. It is minted per call.
- `pnpm verify` green at every phase. `pnpm docs:api` regenerated with any route/schema change.
- Every "Done when" box gets evidence in `tasks/evidence/`.

## P1 — B12: the reconciliation reader calls an endpoint that does not exist

**Defect, proven against the sandbox.** `.env` holds real sandbox credentials
(`SEPAY_ENVIRONMENT=sandbox`, `SEPAY_MERCHANT_ID=SP-TEST-LDAB5895`), so the sweep can be probed
rather than reasoned about. `SepayRestOrderClient` requests:

```
GET https://pgapi-sandbox.sepay.vn/v1/orders?order_invoice_number=…   → 404 text/html
```

but the host serves:

```
GET https://pgapi-sandbox.sepay.vn/v1/order?order_invoice_number=…    → 401 application/json
```

`/v1/orders` (plural) is not a route — it answers the host's HTML 404 page. The client's
`response.ok` check would throw `SePay order lookup failed (HTTP 404)`, so **every sweep would have
failed the moment anyone set `SEPAY_RECON_ENABLED=true`**. That is precisely why the flag being off
by default has been hiding it.

**Second finding, and why the "prove the parser" half is still not reachable.** The REST endpoint
answers `401 Unauthorized` for every auth form the client could plausibly send — `Bearer <secret>`,
raw `Authorization`, `X-Secret-Key`, `X-Api-Key`, `X-Merchant-Id`+secret, and `Bearer <merchant>` —
all seven probed. `spsk_test_…` is the **Payment Gateway HMAC** secret used to sign the checkout
form; the Order API needs a **separate API key** the repo does not hold. So:

- The **path** defect is fixable now and is a real bug.
- The **field names** (`order_invoice_number`, `order_status`, `order_amount`, `transaction_date`)
  still cannot be verified, because no call reaches the body. The honest action is to say so at
  every place a future reader would otherwise assume otherwise.

**Work.**
1. `/v1/orders` → `/v1/order` in `sepay-rest-order-client.ts`.
2. Distinguish "not found" from "not authenticated". Today a `401` throws a generic error; it must
   name the real cause, because an operator reading a log line needs to know the difference between
   "SePay is down" and "your key is the wrong kind of key".
3. A unit test pinning the URL — the defect existed because nothing asserted it.
4. Record in the SRS (and the runbook) that the flag exists, has never reconciled a real order, and
   that field names remain documented-not-observed, with the reason (PG secret ≠ Order API key).

**Done when.** Test asserts `/v1/order` singular. A live probe against the sandbox is transcribed in
the evidence, showing the path now reaches a JSON responder instead of an HTML 404. The SRS records
the exclusion. `pnpm verify` green.

## P2 — ADR-023 amendment

Append-only. States four things the current ADR never did: the download port, who may use it
(admin + verifier), the TTL (300 s, ≤ 5 min as the task doc already suggested), and that the read is
audit-logged while the URL is never persisted. Also records that the reference (not a URL) is what
rides on the record.

**Done when.** `git log --oneline -1 -- docs/adr` names ADR-023, and the amendment precedes the B8
code commit.

## P3 — B8: an admin can open the uploaded document

**Why it matters.** `studentVerificationSchema` carries `schoolName` and `major` — both typed by the
learner — and no document reference. The admin approves the gate that unlocks the teacher badge,
the marketplace filter and payouts, on self-assertion alone.

**Work.**
1. Port: `DownloadTarget` + `createDownloadTarget(objectKey, expiresInSeconds)`; a `DownloadTargetTtl`
   cap so the adapter and the use case cannot disagree.
2. `S3DocumentStore`: SigV4 **GET** presign, reusing `canonicalUri`/`signingKey` — the same signing
   path as PUT, so it cannot drift.
3. Contract: `studentVerificationSchema.documentId: string | null` — the reference only.
4. **New route:** `GET /student-verifications/:id/document` mints a fresh URL per call. Declared
   *after* `@Get('me')` so the literal is not shadowed; the existing route-order test is extended.
5. Ownership: `admin` or `verifier` role. A learner asking for another learner's document gets
   `403`. The document must belong to the verification (`document_ref`), never an id from the query.
6. **Audit through the outbox**, not a repository call: emit `student_verification.document.read`
   with `actorId`, and register it in `admin-operation`'s audited list.
7. `documentId` also returned by `GET /student-verifications/me` so the owner can see what they
   submitted (a reference, never a URL).

**Done when.** Adapter test proves `expiresInSeconds ≤ 300` and the signed verb is `GET`. A learner
requesting someone else's document gets 403/404 and never a URL. `git grep -n downloadUrl --
apps/api/src` matches only the response DTO and the adapter — no column, no log line. End to end:
upload a PDF as a learner, fetch it as admin, compare bytes. An audit row attributes the read to the
admin. `GET /student-verifications/me` still resolves to the caller.

## P4 — B9: certificate evidence with a document

**Why.** `submitSkillEvidenceSchema` already allows `evidenceType: 'certificate'` and `documentRef`.
No app can produce one — mobile has a file picker and still cannot.

**Work.**
1. `POST /skill-evidence/documents` mirroring the student-verification upload route: same
   `DocumentStore`, same content-type allow-list, same size cap. Reuse the validation, do not copy
   the rules — a second copy is how the two diverge.
2. Persist `documentRef` on submit when provided; keep it `null` for other evidence types.
3. The verifier queue already returns `documentRef`; add a download route reusing B8's port so a
   verifier can open the certificate. Same TTL, same audit.
4. Contract: `documentRef` on the evidence read model if it is not already there.

**Done when.** `POST /api/skill-evidence/documents` returns `uploadUrl`/`objectKey`/`expiresAt`.
Submitting a certificate with a `documentRef` and reading `GET /skill-evidence/:id/history` shows
both. A verifier opens the file and the bytes match. Existing decision tests (rejection reason
required) still pass.

**Deviation, recorded (2026-11-08).** Item 1 says "reuse the validation, do not copy the rules". That
is not achievable and the plan was wrong to ask for it:

- `domain-application-stay-inside-module` (`.dependency-cruiser.cjs`) makes `internal/domain/` and
  `internal/application/` importing `apps/api/src/shared/` a **hard error**. Verified by probe, not
  assumed: an application-layer spec importing `shared/storage/s3-presign` fails `test:arch`.
- So the *policy* (`assertUploadable` + `buildObjectKey`) cannot be imported by either module's
  domain or application. A spec under `internal/application/` cannot even reach it.
- What **is** shared is the expensive half: `shared/storage/s3-presign.ts` holds the one SigV4
  implementation, because it is reached from `adapter/`, which the same rule permits. Both modules'
  adapters delegate to it, and `s3-evidence-document-store.spec.ts` pins that they sign identically.
- The duplicated part is four `if` statements whose *values* (`s3AllowedContentTypes`,
  `s3MaxUploadBytes`) come from the one `ApiConfig`, so the two cannot accept different file types.

The realistic alternative was a `DocumentPolicy` port declared in `application/` and implemented in
`adapter/` over the shared module. It was rejected because it would move file validation out of the
domain and behind an injected interface for no behavioural gain, against this codebase's existing
pattern (per-module `Clock`, per-module `AccessDeniedError`). Recorded here so the next reader knows
the duplication is forced and bounded, not an oversight.

**Also changed from the plan.** Item 3 said the download route should reuse B8's port. It reuses
B8's *policy* (ADR-023 Amendment A: `admin` + `verifier`, 300 s, audited, key from the row) but not
its TypeScript interface, because a port belongs to a module. The first implementation additionally
required the Verifier to have claimed the row; the live probe showed that is wrong — claims are
permanent (no release), so a Verifier could not open a file to decide whether to take it. Access is
now role-based, exactly as B8's is.

## P5 — B11: money that moves without telling anyone

Runbook `transaction-trace.md` recorded four gaps. On investigation **one of them was stale**, so the
phase is smaller than planned — and that is the useful finding:

| Movement | Today | After |
|---|---|---|
| Booking refund | ledger row, no event | `wallet.transaction.completed` `booking_refund`, direction `credit` |
| Income release | ledger row, no event | `wallet.transaction.completed` `income_release`, direction `credit` |
| Top-up reversal | ledger row, no event; schema has no member | new `reversal` member, direction `debit` |
| Top-up | ~~notification yes, audit no~~ | **already works** — see below |

**Amended 2026-11-08: the top-up audit gap is stale.** The runbook claimed nothing reaches
`admin_operation.admin_audit_event` for a top-up. A live SePay IPN disproved it: the settlement already
produces `wallet.transaction.completed`, and `admin-operation` has mapped that event to an audit row
since PR #93 (`audit-actions.ts` carries `walletTransactionCompleted`, `actor_id` is
`SYSTEM_ACTOR_ID`, `target_type` is `wallet_transaction`, `target_id` is the ledger id). Nothing was
built for it; the runbook was corrected and the gap re-pointed at what is genuinely unaudited —
initiation, not settlement.

**Work.**
1. `refundBooking` / `releaseIncome` emit the event **inside the same transaction** as the ledger
   write, with `transactionId` = the inserted ledger id and `RETURNING "id", "created_at"` added to
   both inserts — the durable identity `settleBooking`/`applyTopUp` already use.
2. Contracts: add `'reversal'` to the `type` enum with a refinement `reversal → direction debit`,
   mirroring `booking_payment`. Keep every existing member and rule untouched.
3. Thread `actorId` through `RefundBookingRequest` / `ReleaseIncomeRequest` from their use cases, the
   way `SettleBookingRequest` already does: passed in as `SYSTEM_ACTOR_ID`, never imported by the
   repository, so the wallet module does not decide who the actor was. The beneficiary
   (`learnerId` / `teacherId`) is a different field and stays distinct (ADR-035).
4. `notification-copy.ts` unchanged: `wallet_transaction` copy already covers all three, and
   `wallet.transaction.completed` is already consumed into an inbox row. So the three movements
   become visible **without** a new notification type — the enum is not widened for display reasons.
5. Tests: each movement emits exactly once; replay does not duplicate; the rollback case proves money
   cannot move without the announcement.
6. Correct `docs/runbooks/transaction-trace.md`: the stale audit gap, the `reversal` row, and the fact
   that `sepay-ipn.ts` treats only `TRANSACTION_VOID` as a reversal (an `ORDER_REFUNDED` delivery is
   acknowledged and ignored).

**Done when.** Every ledger row produced by the trace runbook maps to a notification or a documented
silent case. A refund and an income release each produce an inbox row. A reversal produces one.
`git grep -nE "parseFloat|toFixed.*[Pp]rice" -- apps/api/src` shows no float arithmetic on money.
Broker-killed replay yields exactly one notification. Live evidence in `tasks/evidence/b11-*.md`.


## Out of scope, stated

- The **client** half. B8/B9/B11 are server tasks; web W9/W10 and mobile MM5/MM6 are separate
  documents, and a shipped backend task does not fix a screen.
- Any new **notification type**. The existing `wallet_transaction` copy already says what happened;
  widening the enum for display would be a contract change with no reader to benefit.
