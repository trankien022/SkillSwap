# B9 — a learner attaches a certificate and a verifier opens it

Date: 2026-11-08T02:24:58Z
Gateway: http://localhost:4000
Object store: http://localhost:9000 (path-style bucket `skillswap-documents`)

Authenticated: user1 (learner, already a verified student), admin, verifier1, user2 (a second
learner, used as the negative case).

Every check below is a live probe run against the real stack — Postgres, RabbitMQ, MinIO — not a
mock. Two scripts produced it:

- `b9-evidence.mjs` — the assertion table (17 checks, all pass).
- `b9-values.mjs` — the same flow with every value printed, which is where the numbers below come
  from.

Learner account id: `1cf2cc02-83d1-480c-9b07-5f530ea2b74e`.

## 1. The learner asks where to put a certificate

```
POST /api/skill-evidence/documents → 201
  uploadUrl: http://localhost:9000/skillswap-documents/1cf2cc02-…/46af03e8-….pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256…
  objectKey: 1cf2cc02-83d1-480c-9b07-5f530ea2b74e/46af03e8-d9e0-457d-b2d4-e4699bb58c67.pdf
  expiresAt: 2026-11-08T02:39:58.186Z
```

All three fields the task names are present. The key is built **server-side** from the caller's
account id, so a client cannot aim an upload at somebody else's prefix, and a `../../etc/passwd`
file name contributes nothing but an extension that the allow-list then judges.

## 2. Bytes go client → store, never through the API

```
PUT <presigned uploadUrl> → 200 OK
uploaded bytes:  96
uploaded sha256: 077d17b24cbe7c31f7b0430cf0b7a4d62ce3d558c416aae57b4670cd8649bfc7
```

The file never reaches the API, so there is nothing for it to log or buffer.

## 3. The learner submits a `certificate` referencing that key

```
POST /api/skill-evidence → 201
  id:            c023d73d-9c1f-42f1-9f67-f352dc2d0f3c
  version:       1
  evidenceType:  certificate
  documentRef:   1cf2cc02-83d1-480c-9b07-5f530ea2b74e/46af03e8-d9e0-457d-b2d4-e4699bb58c67.pdf
  status:        pending
```

`documentRef` is persisted when supplied and stays `null` for a `verifier_assessment`, which is the
only other evidence type. A certificate *without* a document is still refused
(`EvidenceDocumentRequiredError`) — that rule predates this task and is unchanged.

## 4. `GET /:id/history` shows **both** fields

```
GET /api/skill-evidence/c023d73d-…/history → 200
  versions[0].version:      1
  versions[0].evidenceType: "certificate"
  versions[0].documentRef:  "1cf2cc02-83d1-480c-9b07-5f530ea2b74e/46af03e8-….pdf"
```

**This required a contract change.** `evidenceVersionHistorySchema` carried the status, the levels
and the audit trail, but not the two fields that say *what* the evidence was and *which file* it
referenced. Both were added — `evidenceType` (non-null: every version has one) and `documentRef`
(nullable: versions written before certificate uploads existed have no file). Additive, so no
existing client breaks.

## 5. A verifier opens the file, and the bytes match

```
GET /api/skill-evidence/c023d73d-…/document (verifier1, not yet claimed) → 200
  expiresAt:   2026-11-08T02:29:58.273Z
  ttl observed: 300 s (cap 300 s)
GET <downloadUrl> → 200
  bytes:  96
  sha256: 077d17b24cbe7c31f7b0430cf0b7a4d62ce3d558c416aae57b4670cd8649bfc7
  matches the uploaded bytes: true
```

The bit worth calling out: the verifier had **not claimed** the row. An earlier draft required a
claim, and the live probe caught it — claims in this MVP are permanent (there is no release), so a
Verifier wanting to look at a certificate *before* deciding whether to take the case would have been
refused the very file they need in order to decide. Access is now role-based, exactly as ADR-023
Amendment A already decided for identity documents. The claim is a work assignment; the role is the
permission.

## 6. Access control

| Caller | Result |
|---|---|
| owner (user1) | `200` — may open their own certificate |
| admin | `200` |
| verifier (any Verifier, claimed or not) | `200` |
| user2 (another learner) | `403 AccessDeniedError` |
| unknown evidence id | `404 EvidenceNotFoundError` |
| evidence with no file (`verifier_assessment`) | `404 EvidenceDocumentMissingError` — distinct from "does not exist" |

The object key always comes from the stored row. There is no body or query parameter through which a
caller could name a different object, so holding either role cannot be turned into a reader for the
whole bucket. A spec asserts this directly by smuggling an `objectKey` into the command and checking
that the stored one is what gets signed.

## 7. A reference minted for another account is refused

```
POST /api/skill-evidence
  { evidenceType: "certificate", documentRef: "22222222-…/someone-elses.pdf" } → 403 ForeignEvidenceDocumentError
```

This guard is new, and it closes a hole that B9 itself opened. `documentRef` has always been a free
string, but before this task nothing could *open* one, so an arbitrary value was inert. Now a
reviewer downloads it. Since a key is minted as `<accountId>/<uuid>.<ext>` and an account id is not a
secret, a learner could otherwise name somebody else's real object and have a reviewer open it.

The rule is deliberately narrow, so that it is additive rather than breaking:

- A reference whose **first segment is a UUID** is one of ours, and it must equal the caller's
  account id.
- Anything else (`docs/cert.pdf`, an external URL) is not a key this bucket can resolve. Those pass
  through unchanged — the contract has always described `documentRef` as a free string, and signing
  one yields `NoSuchKey` rather than another account's file. Tightening that would have broken every
  client already sending a free-form reference, and every seeded row.

The guard runs **before** any write, so a refused submission leaves no pending version behind.

## 8. The upload policy

```
POST /api/skill-evidence/documents  { contentType: "text/html" }  → 415 UnsupportedEvidenceTypeError
POST /api/skill-evidence/documents  { sizeBytes: 10 MiB + 1 }     → 413 EvidenceTooLargeError
POST /api/skill-evidence/documents  { sizeBytes: 10 MiB }         → 201 (exactly the cap is allowed)
```

Same allow-list (`application/pdf`, `image/png`, `image/jpeg`) and same 10 MiB cap as the identity
flow. Both read `ApiConfig.s3AllowedContentTypes` and `s3MaxUploadBytes`, so they cannot accept
different file types or sizes.

## 9. The decision path is untouched

```
pnpm --filter @skillswap/api test -- src/modules/skill-verification
  Test Suites: 24 passed, 24 total
  Tests:       185 passed, 185 total
```

including every existing decision test: a rejection still requires a reason, an unclaimed row is
still not decidable, and a certificate still cannot be submitted without a document.

`pnpm verify` (lint + build + typecheck + tests + arch rules) exits 0. The e2e suites that touch this
module also pass unchanged:

```
pnpm --filter @skillswap/api test:e2e -- evidence-history skill-evidence
  PASS test/evidence-history.e2e-spec.ts
  PASS test/skill-evidence.e2e-spec.ts
```

## 10. The audit trail, read back from Postgres

Every successful read emits one outbox event, which the audit consumer turns into one
`admin_operation.admin_audit_event` row. **No row carries the URL.**

```
=== skill_verification.outbox_messages (payload) ===
              actor_id              | actor_role |                                 document_ref                                  | has_url
------------------------------------+------------+-------------------------------------------------------------------------------+---------
 1cf2cc02-83d1-480c-9b07-5f530ea2b74e | user       | 1cf2cc02-…/28d541f5-….pdf                                                     | f
 71ee3185-8120-41b6-bbdd-197c483b2e92 | admin      | 1cf2cc02-…/28d541f5-….pdf                                                     | f
 3cff160f-ec8d-421d-afad-9996faa04c2d | verifier   | 1cf2cc02-…/28d541f5-….pdf                                                     | f

=== admin_operation.admin_audit_event (metadata) ===
{"actorRole": "user",     "documentRef": "1cf2cc02-…/28d541f5-….pdf"}
{"actorRole": "admin",    "documentRef": "1cf2cc02-…/28d541f5-….pdf"}
{"actorRole": "verifier", "documentRef": "1cf2cc02-…/28d541f5-….pdf"}
```

| Property | How the row shows it |
|---|---|
| Who read | `actorId` is the reader, which is **not** the evidence owner for the admin and verifier rows. |
| In what capacity | `actorRole` distinguishes `admin` from `verifier` from the owner (`user`). |
| Which file | `documentRef` is the object key. |
| No credential on disk | `has_url = f` on every row. `X-Amz-Signature` appears only in the port, the adapter, the use case and their specs — never in a column or a log line. |

A refused read (user2's `403`) produced **no** audit row, which is the correct record: the caller
never reached the store, so no credential was ever issued.

## What this proves, against the task's done-when

- [x] `POST /api/skill-evidence/documents` returns `uploadUrl`, `objectKey`, `expiresAt` — step 1.
- [x] Submitting a certificate with a `documentRef`, then reading `GET /:id/history`, shows both
      fields — step 4. (Needed both fields *added* to the history contract; they were absent.)
- [x] A verifier can open the file and the bytes match — step 5, `sha256` equal.
- [x] The existing decision tests still pass — step 9.
- [x] `pnpm verify` exits 0.

## Deviations from the plan, and why

**1. The upload policy is a second copy of the identity one, not a shared import.** The plan asked to
"reuse the validation, do not copy the rules". That is impossible here, and it was verified rather
than assumed: rule `domain-application-stay-inside-module` in `.dependency-cruiser.cjs` makes
`internal/domain/` and `internal/application/` importing `apps/api/src/shared/` a hard **error**. A
probe file at `internal/application/__probe.spec.ts` importing `shared/storage/s3-presign` failed
`pnpm test:arch`; it was removed immediately after.

So neither module's domain or application can reach a shared policy module — not even from a spec
file under those directories. What *is* shared is the part that is genuinely hard to get right:
`shared/storage/s3-presign.ts` holds the single SigV4 implementation, reached from `adapter/`, which
the same rule permits. Both modules' adapters delegate to it, and
`s3-evidence-document-store.spec.ts` pins that identical input yields an identical signature, so a
divergence in canonicalisation would fail a test rather than ship.

The copied part is four `if` statements, and their *values* come from the one `ApiConfig`, so the two
flows cannot accept different file types or size caps. A `DocumentPolicy` port implemented in the
adapter was considered and rejected: it would move file validation out of the domain and behind an
injected interface for no behavioural gain, against this codebase's existing per-module pattern
(`Clock` and `AccessDeniedError` are already duplicated per module for the same reason).

**2. The download route does not reuse B8's TypeScript port.** It reuses B8's *policy* — `admin` +
`verifier`, 300 s, audited, key from the row — but a port belongs to a module, so skill-verification
declares its own `EvidenceDocumentStore`. The two interfaces are structurally identical at the S3
level and both adapters sit on the same signer.

**3. Read access is role-based, not claim-based.** Described in step 5: the live probe showed the
claim-gated version blocked the actual workflow.

## Known gap, stated

A Verifier may open **any** certificate, not only those in their expertise set. That matches B8 (any
Verifier may open any identity document, and an Administrator any of either) and ADR-023 Amendment A,
so it is the decided policy rather than an oversight — but it is a wider read surface than "the
reviewer of this case", and it is worth a product decision if that changes. It is not silently
narrowed here, because narrowing it would contradict the ADR.

## Reproducing

```bash
docker compose up -d                                   # postgres, rabbitmq, minio
pnpm db:migrate && pnpm db:demo
pnpm --filter @skillswap/contracts build
pnpm --filter @skillswap/api build && pnpm --filter @skillswap/gateway build
(cd apps/api && node dist/bootstrap/main.js)           # 4001
(cd apps/gateway && node dist/bootstrap/main.js)       # 4000
node b9-values.mjs       # every value printed
node b9-evidence.mjs     # the 17-check assertion table
```

`user1` already has a seeded effective student verification, which is what lets them submit evidence
at all, so the probe does not need to revoke and re-create it (unlike B8's).

Note: the e2e suites truncate and re-seed the database, so `pnpm db:demo` must be re-run afterwards
before the probe will find the demo accounts.
