# ADR-038 — Student-verification documents are stored in Cloudinary

**Status:** Accepted. Supersedes [ADR-023](ADR-023-student-verification-model.md) decision 4 (S3 object storage) and
the `Storage` half of its storage/validity decision set. ADR-023's *model* — one effective verification, no expiry,
no deletion, `pending → approved | rejected` — is untouched.
**Date:** 2026-11-08
**Level:** Software (C4 Level 3 · Component)

**Context.** ADR-023 decision 4 chose "S3 object storage with Postgres metadata", and the implementation settled on
MinIO inside `docker-compose.yml`. That was workable for a laptop-only demo but it is the reason the stack cannot be
deployed: MinIO is a service this project operates, and no permanently-free PaaS will run it. The requirement is a
real, managed, third-party store.

The `DocumentStore` port was built for this: `createUploadTarget(input) → UploadTarget` with
`{ uploadUrl, objectKey, expiresAt }`, and the note that "the S3 adapter issues pre-signed URLs". That shape is
SigV4-specific, and Cloudinary has no equivalent, so the port's *return type* — not its intent — is what changes.

**Decision.**

1. **The vendor is Cloudinary**, replacing MinIO behind the unchanged `DocumentStore` port. The adapter is
   `CloudinaryDocumentStore`. There is no fallback adapter and no environment branch: MinIO is removed from
   `docker-compose.yml` along with its init container. This follows the rule ADR-033 §2 set for SePay — one adapter,
   configuration is a value, not a decision point.

2. **Uploads are a signed multipart `POST`, so `UploadTarget` gains `method` and `fields`.** Cloudinary authenticates
   an upload with `api_key` + `timestamp` + `signature` in the request body, not with a signature embedded in the URL.
   The port therefore returns the endpoint, the verb, and the **exact** field map that was hashed. Clients must send
   every field verbatim: Cloudinary re-signs what it receives and rejects any divergence. `uploadUrl` keeps its name
   and meaning ("where the bytes go"); `objectKey` becomes the Cloudinary `public_id`.

3. **The signature is SHA-1 hex over alphabetically-sorted `k=v` pairs plus the secret, per Cloudinary's documented
   default,** excluding `file`, `cloud_name`, `resource_type` and `api_key`, and always including `timestamp`. The
   algorithm is replicated in-repo rather than taking the Cloudinary SDK as a dependency, for the same reason ADR-033
   §5 replicated SePay's signing: it is a handful of lines, and a pinned test is worth more than an opaque transitive
   dependency in a path that handles identity documents.

4. **Documents are uploaded as `type: authenticated`.** FR-002 documents are identity papers, and NFR-004 says their
   contents must not leak. Cloudinary's default `upload` type is publicly readable at a CDN path. `authenticated`
   makes both the original and any derived asset reachable only through a signed delivery URL. The reviewer UI does not
   fetch document bytes today, so no delivery URL is issued yet — when one is added it **must** be signed
   server-side, never a bare `res.cloudinary.com` link.

5. **`resource_type` is derived from the declared content type**: `raw` for anything that is not an image, `image` for
   `image/png` and `image/jpeg` (PDFs are `image` in Cloudinary's model). Deriving it explicitly is preferred to the
   `/auto/` endpoint because the routing is then a testable function rather than a vendor heuristic, and because a
   `raw` public id must retain its file extension — a rule that would otherwise be discovered in production.

6. **The 10 MB free-plan ceiling is the upload bound.** Cloudinary's Free plan caps a raw or image file at 10 MB, which
   coincides with `DEFAULT_MAX_UPLOAD_BYTES`. The limit stays configurable and validated in the domain
   (`assertUploadable`, NFR-008); raising it beyond the plan's cap would fail at the vendor, not in our domain, so the
   two must be changed together.

**Consequences.**

- The upload protocol changes on **both** clients. The web and mobile uploaders issued a raw `PUT`; they now build a
  `FormData` request. The port change is what makes that visible in the type system instead of at runtime.
- Cloudinary upload signatures carry **no documented expiry**. `UploadTarget.expiresAt` is therefore advisory — a
  client-side guard against stale targets, not a vendor-enforced deadline as SigV4's `X-Amz-Expires` was. A leaked
  target is reusable until the document exists; the mitigations are the `authenticated` delivery type and a
  non-guessable per-document `public_id`. This is a real reduction in protection against the previous adapter and is
  recorded rather than glossed over.
- Free accounts block **delivery** of PDFs by default. A deployment using PDF documents must enable
  *Allow delivery of PDF and ZIP files* in Console → Security. Upload and storage are unaffected.
- 25 credits/month (1 credit = 1 GB stored **or** 1 GB bandwidth **or** 1,000 transforms) is the operating envelope.
  Identity PDFs of ~1 MB put the storage cost far below the cap for a pilot, but the plan has no rollover.

**Rejected alternatives.**

- **Keep MinIO for local development and Cloudinary for production.** Rejected: it doubles the adapter surface and
  leaves a self-hosted service in the stack that the deployment goal exists to remove.
- **Cloudflare R2 / Tigris.** Both are S3-compatible and would have kept the pre-signed `PUT` contract unchanged — a
  materially smaller diff. Rejected by developer decision in favour of Cloudinary. Recorded because the cost of that
  choice is the client rewrite, and a future reader should see the trade rather than assume it was forced.
- **Unsigned upload with a preset.** Rejected: an exposed unsigned preset lets anyone write into the account, and
  signature generation on the server is exactly what the port already exists to do.
