# Merging `main` into `feat/cloudinary-and-jaas`: one storage vendor, no S3

**Date:** 2026-11-08
**Branch:** `feat/cloudinary-and-jaas`
**Target:** `origin/main` @ `986da38` (3 commits ahead of the branch's fork point `b69c00f`)
**Related:** [ADR-038](../adr/ADR-038-cloudinary-document-storage.md), [ADR-039](../adr/ADR-039-hosted-jaas-class-rooms.md),
[ADR-023 Amendment A](../adr/ADR-023-student-verification-model.md)

## Why this plan exists

The branch exists to delete self-hosted MinIO and self-hosted Jitsi. `origin/main` moved on while it was open and added
two features that are **built directly on S3**:

| Upstream work | What it added | Why it collides |
|---|---|---|
| **B8** — document download | `createDownloadTarget` on `student-verification`'s `DocumentStore` port + `ReadVerificationDocumentUseCase` | The Cloudinary adapter has no `createDownloadTarget`, so the port is unimplemented |
| **B9** — certificate evidence | `skill-verification`'s `EvidenceDocumentStore`, `S3EvidenceDocumentStore`, `shared/storage/s3-presign.ts`, wired to `config.s3*` | This branch deleted `config.s3*` and MinIO from `docker-compose.yml` |

Merging applies cleanly except for four files, but leaves a tree that **does not typecheck**: nine `config.s3*` property
errors and one missing `createDownloadTarget`. Conflict resolution alone cannot fix it — the two sides disagree about
which storage vendor exists.

**Decision (developer-confirmed):** port both features to Cloudinary. One storage provider, `docker-compose.yml` stays
MinIO-free. Keeping S3 for evidence was rejected because it resurrects the self-hosted service the branch removes, and
`s3-presign.ts` would then exist solely to serve a container the project cannot deploy.

## Invariants this must not break

- **NFR-004:** identity documents and certificates are never readable at a guessable path. Uploads stay
  `type: authenticated`; every read URL is minted server-side and short-lived.
- **ADR-023 Amendment A:** a download URL is a bearer credential with a **300 s hard cap**, enforced by the adapter
  (refuse, never clamp). It is never persisted, logged, or listed.
- **No money changes:** integer VND, 1 credit = 1,000 VND, 1000 bps fee. Untouched by this work.
- **Module boundaries:** `domain/` may not import `shared/`; a module may not import another module's ports. Structural
  typing is how one adapter satisfies two ports; that is the existing precedent in both ports' doc comments.

## Vendor contract (verified from Cloudinary docs, not inferred)

The read path has no S3 pre-signed GET equivalent, and the choice here is not cosmetic:

| Option | Expires? | Verdict |
|---|---|---|
| Signed delivery URL `…/authenticated/s--SIG--/<public_id>` | **No.** The `s--SIG--` signature is a permanent bearer credential | Rejected — would make the 300 s cap a lie |
| `private_download_url` → `https://api.cloudinary.com/v1_1/<cloud>/<resource_type>/download?…&expires_at=…` | **Yes**, server-enforced via `expires_at` (UNIX seconds) | **Chosen** — the only documented option that honours the cap |

Signature payload for the download endpoint, from the Cloudinary Node SDK (`utils.private_download_url` →
`sign_request` → `api_sign_request`):

1. Signed params are `timestamp`, `public_id`, `format`, plus optional `type`, `attachment`, `expires_at`.
2. Blank values are dropped. `api_key`, `cloud_name` and `resource_type` are **never** signed.
3. Keys sorted, joined as `k=v&k=v`, `api_secret` appended with no delimiter, SHA-1 hex.

Note the asymmetry that makes this tricky: for `raw` assets the extension **is part of** `public_id`; for `image`
assets it is the separate `format` field. `publicIdFor()` already encodes that rule and stays authoritative.

## Phases

Each phase is one commit and leaves the tree buildable.

### Phase 1 — `fix(api)`: move Cloudinary signing into `shared/storage`

Extract the vendor arithmetic out of `student-verification`'s adapter so `skill-verification` can use the same code,
mirroring the pattern upstream established for `s3-presign.ts` (shared technical glue, per-module ports and policy).

- New `apps/api/src/shared/storage/cloudinary-sign.ts`: `resourceTypeFor`, `publicIdFor`, `uploadSignature`,
  `downloadSignature`, `privateDownloadUrl` — with the existing doc comments carried over and the download half added.
- Move its spec alongside it; keep every currently-pinned signature assertion.
- Behaviour of the upload path must not change: the same fields in, the same signature out.

**Commit:** `refactor(api): hoist Cloudinary signing into shared/storage`

### Phase 2 — `fix(api)`: implement `createDownloadTarget` for student documents

Closes the B8 break.

- `CloudinaryDocumentStore` gains `createDownloadTarget`, delegating to `shared/storage/cloudinary-sign`.
- Refuses `expiresInSeconds` outside `(0, DOWNLOAD_URL_TTL_SECONDS]` with the port's existing
  `DownloadTtlTooLongError`.
- Spec pins: `expires_at` present and equal to `now + ttl`; `type=authenticated` in the query; signature stable for a
  fixed clock; `raw` vs `image` public-id/format split; over-long TTL throws rather than clamps.

**Commit:** `feat(api): sign Cloudinary download targets for student documents`

### Phase 3 — `fix(api)`: migrate certificate evidence to Cloudinary

Closes the B9 break and removes S3 from the codebase.

- `EvidenceDocumentStore.createUploadTarget` returns the signed **multipart form** shape (`method`, `fields`) instead of
  a pre-signed URL — the same shape `DocumentStore` already returns.
- New `CloudinaryEvidenceDocumentStore` in `skill-verification`'s adapter dir, thin, delegating to
  `shared/storage/cloudinary-sign`; keeps this module's own TTL policy and port shape.
- Delete `S3EvidenceDocumentStore`, its spec, `shared/storage/s3-presign.ts` and its spec.
- Rewire `skill-verification.module.ts` from `config.s3*` to `config.cloudinary*`.
- Update the two use-case specs' fakes, `evidence-document.ts`'s doc comment (it names `s3-presign.ts`), and the port's
  doc comment (it names `S3DocumentStore`).
- `RequestEvidenceDocumentUploadUseCase` passes the form through unchanged.

**Commit:** `feat(api): store certificate evidence in Cloudinary`

### Phase 4 — `fix(contracts)`: evidence upload target is a signed form

`evidenceDocumentUploadTargetSchema` currently describes a pre-signed PUT. With Cloudinary the client must POST a
multipart body, so the contract must say so — otherwise the endpoint is unimplementable.

- Add `method: z.literal('POST')` and `fields: z.record(z.string(), z.string())`, matching
  `documentUploadTargetSchema`.
- Spec covers: accepted form, `fields` required, `method` must be `POST`.
- No client consumes this endpoint yet (web and mobile only call the student-verification one), so this is additive in
  practice; the payload still carries `uploadUrl`, `objectKey`, `expiresAt`.

**Commit:** `fix(contracts): describe the evidence upload as a signed form`

### Phase 5 — `fix(api)`: adapter and controller docs follow the vendor

- `skill-evidence.controller.ts` `@ApiOperation`/`@ApiOkResponse` text says "pre-signed PUT URL"; restate it as a
  signed upload form.
- Regenerate `docs/api` (`pnpm docs:api`) so the published reference matches.
- Update the stale S3 phrasing in `docs/api/student-verification.md` / `FRONTEND-API-GUIDE.md` where it describes a
  pre-signed URL, and the ADR-023 Amendment A note that says "pre-signed GET".

**Commit:** `docs(api): document Cloudinary signed forms and downloads`

### Phase 6 — `docs(adr)`: record the consequence

ADR-038 gains a short amendment rather than a rewrite (ADRs are append-mostly):

- Its scope now covers **certificate evidence** as well as identity documents, because `main` added that feature and it
  had to land on the same vendor.
- The read path is `private_download_url` with `expires_at`; the rejected `s--SIG--` option and *why* it was rejected
  (no expiry ⇒ defeats the 300 s cap) go on the record.
- `shared/storage/s3-presign.ts` is gone; S3 is no longer part of this system.

**Commit:** `docs(adr): extend ADR-038 to certificate evidence and the read path`

### Phase 7 — verify

- `pnpm verify` green (lint at `--max-warnings=0`, no new warnings).
- E2E against a **scratch** database migrated from this branch — not the local `skillswap` dev DB, which carries
  `main`'s schema and would mask skew: `jaas-room-access`, `room-idle`, `room-idle-payment`, plus the evidence suites
  (`skill-evidence`, `evidence-history`, `verifier-decision`, `audit-actor`) that exercise the migrated store.
- Confirm `grep` finds no remaining `s3`/`S3` in `apps/api/src` outside ADR prose.
- Confirm `docker-compose.yml` still declares only postgres + rabbitmq.

## Risks

| # | Risk | Handling |
|---|---|---|
| M1 | `expires_at` is the **only** thing enforcing the read cap; a bug in signing fails open | Spec pins the exact payload; over-long TTL throws; live check needs credentials |
| M2 | Cloudinary free tier blocks **PDF delivery** until enabled in Console → Security | Already recorded in ADR-038 and `.env.example`; evidence is overwhelmingly PDF, so this now blocks *both* features, not just one |
| M3 | `private_download_url` is billed at double bandwidth (not CDN-cached) | Accepted: reviewer-opened documents are rare and small; the alternative is an unbounded-lifetime URL |
| M4 | The evidence contract change could break an unseen consumer | Verified: no web/mobile caller exists; `docs/api` regenerated in the same change |
| M5 | `raw` vs `image` public-id/format split is easy to get subtly wrong | One `publicIdFor()` in `shared/`, pinned by a spec, used by both adapters |
| M6 | Live vendor acceptance still impossible without credentials | Unchanged from the migration plan's blocked item; recorded, not hidden |

## Out of scope

- Regenerating the C4 diagrams: the model already shows Cloudinary as the single external store and lists no S3
  boundary, so this merge adds no diagram element. Re-check in Phase 7 and only re-render if a view is now inaccurate.
- Any JaaS change; the merge does not touch it.

## Execution record (2026-11-08)

All phases landed on `feat/cloudinary-and-jaas` as a single merge commit (`main` was mid-merge, so splitting it further
would have produced commits that did not build). `pnpm verify` green, e2e green against a scratch database.

| Phase | What landed |
|---|---|
| 1 | `shared/storage/cloudinary-sign.ts` + spec; the old module-local copy is gone |
| 2 | `CloudinaryDocumentStore.createDownloadTarget`, TTL cap enforced |
| 3 | `CloudinaryEvidenceDocumentStore`; `s3-presign.ts` and `S3EvidenceDocumentStore` deleted; module rewired to `config.cloudinary*` |
| 4 | `evidenceDocumentUploadTargetSchema` gains `method` + `fields`, with a spec |
| 5 | controller/DTO copies corrected, `docs/api` regenerated, stale S3 prose in ports and the test README swept |
| 6 | ADR-038 Amendment A, decisions 7–9 |

### What the merge itself found

- **A latent bug in B8.** The first cut stored Cloudinary's stripped `public_id` as the document reference. For an
  image asset that id has no extension, so the read path could not have rebuilt a delivery URL and every image
  document download would have failed — quietly, as a broken link. The upload target now carries the domain object key
  and puts the stripped id in `fields.public_id` (amendment decision 9). Caught by a unit test, not in production.
- **`jaas-room-access.e2e-spec.ts` was missing `title`**, which `main` made a required class field after this branch
  was cut. It was the only e2e suite omitting it, because it was authored on this branch.
- **`apps/api/test/README.md` still described the MinIO/Jitsi stack**, from before this branch. Corrected.

### Verification

- `pnpm verify`: lint (`--max-warnings=0`), build, typecheck, unit tests, arch rules — all clean.
- Unit tests: 1,159 api · 251 contracts · 446 web · mobile · gateway, all passing.
- E2E against `skillswap_e2e_merge` (fresh DB, migrated from this branch): **18 of 19 suites pass**, 79 tests,
  1 skipped (the Cloudinary suite, which needs credentials). Includes `student-verification`, `skill-evidence`,
  `evidence-history`, `verifier-decision`, `audit-actor`, `jaas-room-access`, `room-idle`, `room-idle-payment`.
- `docker-compose.yml` declares postgres + rabbitmq only; no `s3`/`S3` symbol remains in `apps/api/src` outside
  historical prose.

### Still blocked (unchanged)

Live vendor acceptance still needs real credentials: `CLOUDINARY_*` to exercise upload *and* the new
`private_download_url` read path, and a JaaS key to open one real room. Recorded in the migration plan's blocked item
and risk M6; not a regression introduced here.

