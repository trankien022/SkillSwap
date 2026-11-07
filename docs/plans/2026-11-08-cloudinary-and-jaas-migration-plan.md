---
title: Cloudinary + JaaS — replace MinIO and self-hosted Jitsi
type: plan
date: 2026-11-08
topic: cloudinary-and-jaas-migration
status: Proposed
owner: Group 4
---

# Cloudinary + JaaS migration

**Supersedes:** part of [ADR-020](../adr/ADR-020-online-class-rooms-self-hosted-jitsi.md) (self-hosted Jitsi) and part of
[ADR-023](../adr/ADR-023-student-verification-model.md) decision 4 (S3/MinIO document storage).
**FRs:** FR-002, FR-011 · **ACs:** AC-006, AC-035, NFR-004, NFR-008 · **Modules:** `student-verification` (adapter
`out/storage`), `live-class` (adapters `out/jitsi`, `in/web`).

---

## 0. Why

`docker-compose.yml` runs MinIO plus a four-container self-hosted Jitsi (`web`, `prosody`, `jicofo`, `jvb`) and exposes
**UDP 10000** for the videobridge. Neither can be deployed to a free PaaS, so the stack cannot leave the laptop. Two
managed services replace them:

| Local today | Replacement | Port that absorbs the swap |
|---|---|---|
| `minio` + `minio-init` | **Cloudinary** (signed uploads) | `DocumentStore` |
| `jitsi-{web,prosody,jicofo,jvb}` | **JaaS / 8x8** (hosted Jitsi) | `RoomTokenIssuer` |

---

## 1. Verified third-party contracts

Everything below was read from the vendors' live documentation on 2026-11-08, not from memory.

### 1.1 Cloudinary

| Fact | Source |
|---|---|
| Free plan = **25 credits/mo**, no expiry. 1 credit = 1 GB stored, **or** 1 GB bandwidth, **or** 1,000 transforms | `cloudinary.com/documentation/pricing.md` |
| Free plan caps **raw file size at 10 MB**, image at 10 MB | pricing.md feature table |
| Upload is a **signed multipart `POST`** to `https://api.cloudinary.com/v1_1/<cloud>/<resource_type>/upload` with `file`, `api_key`, `timestamp`, `signature` | `upload_images.md`, `authentication_signatures.md` |
| Signature = `SHA1(sorted "k=v" joined by "&" + api_secret)` in hex; **sign every field except `file`, `cloud_name`, `resource_type`, `api_key`, and include `timestamp`** | `signatures.md`, `authentication_signatures.md` |
| `resource_type` ∈ `image · video · raw`; **PDFs are `image`**, arbitrary files are `raw`, and **raw public IDs must include the extension** | `upload_parameters.md` |
| `type: authenticated` makes both original and derived assets require a signed delivery URL | `control_access_to_media.md` |
| Free accounts **block PDF *delivery*** by default; the Console → Security toggle "Allow delivery of PDF and ZIP files" enables it | `image_delivery_options.md` |
| No documented TTL on an upload signature (unlike SigV4 `X-Amz-Expires`) | `authentication_signatures.md` |

**What this forces.** The current adapter returns a pre-signed `PUT` URL and both clients `xhr.send(file)` raw bytes.
Cloudinary has no pre-signed-PUT equivalent, so the **upload protocol changes on web and mobile**, not just the adapter.

### 1.2 JaaS (8x8)

| Fact | Source |
|---|---|
| Free developer account = **up to 25 MAU** | `developer.8x8.com/jaas/docs/faq` |
| JWT header = `{alg:"RS256", kid:"<appId>/<keyId>", typ:"JWT"}`, signed with the **API private key** | `api-keys-jwt` |
| Body: `aud:"jitsi"` and `iss:"chat"` are **hardcoded**; `sub` = AppID; `moderator` is the **string** `"true"`; `context.room.regex` optional | `api-keys-jwt` |
| iframe: `new JitsiMeetExternalAPI("8x8.vc", { roomName: "<AppID>/<room>", jwt })`; script at `https://8x8.vc/<AppID>/external_api.js` | `iframe-api-integration` |
| Mobile SDK needs `serverURL:"https://8x8.vc"`, `token`, `roomName:"<AppID>/<room>"` | `mobile-sdk-overview` |
| Webhook events use `eventType` (`PARTICIPANT_JOINED`…), `data.id` = the JWT `context.user.id`, `fqn` = `"<AppID>/<room>"` | `webhooks-events`, `webhooks-payload` |
| Webhook auth = **`X-Jaas-Signature: t=<ts>,v1=<sig>`**, HMAC-SHA256 of `"<ts>.<raw body>"` with the endpoint secret, base64 | `webhooks-signatures` |
| Events are **not** ordered; duplicates carry `idempotencyKey` | `jaas-console-webhooks` |

**What this forces.** Four concrete deltas from the current self-hosted assumption:

1. HS256 shared secret → **RS256 + `kid`**.
2. `aud`/`iss` were the app id → now **fixed strings**, with the app id in `sub`.
3. Rooms are **tenant-prefixed**. `https://${jitsiDomain}/${room}` works unchanged if
   `JITSI_DOMAIN=8x8.vc/<appId>`, but the web `roomName` must also carry the prefix.
4. The presence webhook is a **different payload and a different auth scheme** (`x-jitsi-webhook-secret` does not exist).

### 1.3 Rejected: meet.jit.si

Free and unlimited, but **no JWT authentication** (anyone holding the room URL joins — that silently voids AC-006) and,
since 2026-10-09, **meetings are capped at 95 minutes** (`jitsi.org/blog/changes-coming`). Rejected by decision.

---

## 2. Decisions

1. **Cloudinary behind the unchanged `DocumentStore` port.** `S3DocumentStore` is replaced, not kept as a fallback:
   MinIO leaves `docker-compose.yml` with it. One adapter, one code path, no environment branching
   (the same rule ADR-033 §2 applied to SePay).
2. **`UploadTarget` becomes a signed form, not a URL.** The contract gains `method` + `fields`; `uploadUrl` stays the
   target. Clients POST `multipart/form-data` with the file plus every signed field verbatim.
3. **Documents upload as `type: authenticated`.** FR-002 documents are identity papers (NFR-004). `upload` (public)
   would make every transcript world-readable at a guessable CDN path. Admins still never fetch bytes, so no signed
   delivery URL is issued yet — the delivery gap is recorded in the ADR, not hidden.
4. **`resource_type` is derived from the content type** — `raw` for anything that is not an image, `image` for
   `image/png`/`image/jpeg` — mirroring Cloudinary's own routing rather than relying on `/auto/`.
5. **`JitsiRoomTokenIssuer` is replaced by `JaasRoomTokenIssuer`** (RS256). HS256 is deleted, not left behind: keeping
   both would require maintaining a self-hosted path that no longer exists in the stack.
6. **`JITSI_DOMAIN` carries the tenant** (`8x8.vc/<appId>`). The existing
   `` `https://${jitsiDomain}/${room}` `` then produces the correct JaaS URL with no change to the use case.
7. **The presence webhook is rewritten for JaaS**, verifying `X-Jaas-Signature` over the **raw** body and mapping
   `PARTICIPANT_JOINED`/`PARTICIPANT_LEFT` + `data.id` + `fqn`. `classIdFromRoom` learns to strip the tenant prefix.
8. **Graceful degradation is unchanged.** ADR-020 Amendment A already falls back to `scheduled_end`; if the webhook
   secret is unset the endpoint refuses, exactly as today.

---

## 3. Phases

Each phase is an independent commit and independently verifiable.

### Phase 1 — Contracts

- `packages/contracts`: `documentUploadTargetSchema` gains `method` (`'POST'`) and `fields`
  (`Record<string,string>`, the verbatim signed set).
- Keep `objectKey` (now the Cloudinary public id) and `expiresAt` (advisory — Cloudinary has no signature TTL).
- Extend `apps/api/test/s3-document.e2e-spec.ts` expectations or retire the S3-only assertions.

**Exit:** `pnpm --filter @skillswap/contracts build`.

### Phase 2 — Cloudinary adapter

- New `internal/adapter/out/storage/cloudinary-document-store.ts`:
  - `resource_type` from content type; `type: authenticated`; `public_id` = object key (extension kept for `raw`);
  - `timestamp` + alphabetical `k=v&…` + `api_secret`, **SHA-1 hex** (Cloudinary's documented default);
  - returns the endpoint, `POST`, and the signed field map (never the `api_secret`).
- Delete `s3-document-store.ts` + its spec. Bind `DOCUMENT_STORE` to Cloudinary in the module.
- `ApiConfig`: replace the `s3*` block with `cloudinary*` (`cloudName`, `apiKey`, `apiSecret`, upload TTL/limits).
  Keep `S3_MAX_UPLOAD_BYTES` semantics as `CLOUDINARY_MAX_UPLOAD_BYTES`, defaulting to 10 MB to match the free cap.

**Exit:** unit tests cover the signature string, the resource-type routing, and the absence of `api_secret` in output.

### Phase 3 — Clients upload as multipart

- `apps/web/src/components/verification/VerificationContent.tsx`: replace the `PUT` + `xhr.send(file)` block with
  `FormData` (`file` + every field), `POST`, keeping the progress bar via `xhr.upload`.
- `apps/mobile/.../student-verification-gateway.ts`: same change; the existing guards (protocol, non-empty bytes,
  size match, expiry) are preserved and still tested.

**Exit:** both suites green; the mobile spec's `PUT` assertions updated to assert `POST` + fields.

### Phase 4 — JaaS token issuer

- New `internal/adapter/out/jitsi/jaas-room-token-issuer.ts`: RS256 via `node:crypto` (no new dependency, matching the
  existing "no vendor SDK" pattern), `kid` from config, hardcoded `aud`/`iss`, `sub` = app id,
  `moderator` as the string `"true"`, `context.room.regex=false`.
- Delete `jitsi-room-token-issuer.ts` + spec; rebind `ROOM_TOKEN_ISSUER`.
- `ApiConfig`: `JITSI_APP_ID`, `JITSI_PRIVATE_KEY_PATH` (or inline PEM), `JITSI_KID`. Remove `JITSI_APP_SECRET`.

**Exit:** a spec decodes the header/payload and asserts every claim against the documented example.

### Phase 5 — Web embed + presence webhook

- `jitsi-external-api.ts`: add `jitsiRoomNameFromUrl()` returning `<appId>/<room>`; `jitsiDomainFromUrl()` keeps the
  tenant path so `external_api.js` loads from `https://8x8.vc/<appId>/`. `buildJitsiOptions` drops the `protocol`
  override for JaaS (the API derives it).
- `LiveClassroomContent.tsx`: pass the tenant-prefixed `roomName`.
- `JitsiPresenceController`: verify `X-Jaas-Signature` over the raw body (needs `rawBody: true`, already enabled in
  `bootstrap/main.ts`), map the JaaS payload, strip the tenant from `fqn`.
- Gateway `PUBLIC_PATHS` gains `/api/internal/jitsi` — today the API allows it but the gateway rejects it, so the
  webhook would 401 in production.

**Exit:** presence specs cover a valid signature, a tampered body, and a missing secret.

### Phase 6 — Stack and docs

- `docker-compose.yml`: drop `minio`, `minio-init` and the four `jitsi-*` services plus their volumes.
- `.env.example`: replace the `S3_*` and JITSI secret block; document the Console steps (enabling PDF delivery).
- New ADRs: **ADR-038** (Cloudinary document storage) and **ADR-039** (JaaS hosted rooms), each superseding the part it
  replaces; append a pointer in ADR-020/ADR-023 rather than rewriting them.
- Update the C4 sources if they name MinIO/self-hosted Jitsi, then re-render.

**Exit:** `pnpm verify` green.

---

## 4. Risks

| # | Risk | Severity | Handling |
|---|---|---|---|
| R1 | **Mobile room join cannot use JaaS.** `Linking.openURL(access.url)` cannot carry a JWT; the JaaS Mobile SDK (`@jitsi/react-native-sdk`) requires `serverURL`+`token`+`roomName` | **High** | Out of scope for this migration — needs a native dependency and a prebuild. Recorded in ADR-039; the API already returns the right three values so the client work is additive |
| R2 | Free tier blocks **PDF delivery** | Medium | Console → Security → "Allow delivery of PDF and ZIP files". No admin fetch path exists today, so nothing breaks meanwhile |
| R3 | 25 MAU ceiling | Medium | ~12 two-party classes/month. Recorded; a paid tier or LiveKit is the exit |
| R4 | `authenticated` assets need a signed delivery URL to read | Medium | No read path exists today. When one is added it must be server-signed, never a raw `res.cloudinary.com` URL |
| R5 | Cloudinary signature has **no expiry** | Medium | A leaked target is reusable; mitigated by `authenticated` type, a per-document `public_id`, and short-lived transport (HTTPS only). Stated, not solved |
| R6 | 10 MB free cap collides with a 10 MB default max | Low | Both are 10 MB today; the config value is the single source of truth |
| R7 | JaaS event ordering is not guaranteed | Low | `interpretPresenceEvent` is already order-insensitive for join/leave |

---

## 5. Definition of done

1. `pnpm verify` green (`lint --max-warnings=0`, build, typecheck, tests, arch rules).
2. No `S3_*` / `JITSI_APP_SECRET` / MinIO references left in `apps/` or `docker-compose.yml`.
3. No `api_secret` and no private key in any response body, log, or test fixture.
4. Money invariants untouched (no float VND anywhere in this change).
5. ADR-038 / ADR-039 land before the code that depends on them.

---

## 6. Execution record

Landed on `feat/cloudinary-and-jaas`, branched from `origin/main` at `b69c00f`:

| Phase | Commit | Contents |
|---|---|---|
| 0 | `ee10823` | ADR-038, ADR-039, this plan |
| 1 | `a5d150f` | `documentUploadTargetSchema` gains `method` + `fields` |
| 2 | `fb04d0d` | `CloudinaryDocumentStore` replaces the S3 adapter; config renamed |
| 3 | `c44bb78` | web + mobile upload as signed multipart POST |
| 4 | `57725c6` | `JaasRoomTokenIssuer` (RS256 + `kid`) replaces the HS256 issuer |
| 5 | `d22523f` | tenant-qualified `roomName` / script base; `X-Jaas-Signature`; gateway public path |
| 6 | `40a79a6` | compose, `.env.example`, e2e suites, C4 sources |

**Verified without vendor credentials.** `pnpm verify` (lint, build, typecheck, 1,956 unit tests, arch rules) is
green. The three rewritten e2e suites — `jaas-room-access`, `room-idle`, `room-idle-payment` — pass against a
scratch database migrated from this branch, 18 tests. The Cloudinary suite self-skips.

**Not verified.** No Cloudinary or JaaS account was available, so nothing here proves the vendors accept what we
send. The pinned contracts come from their live documentation, and each was chosen because getting it wrong fails
silently: `moderator` as a string, the tenant-prefixed `room`, the raw-body signature, `type=authenticated`,
`raw` public ids keeping their extension. A first real call is the remaining acceptance step.

**A note on the dev database.** Suites for other modules failed locally with `null value in column "title"` — a
schema added by PR #97, which this branch deliberately excludes because it starts from `main`. Those failures are
branch skew, not this change, which is why verification used a fresh database.

