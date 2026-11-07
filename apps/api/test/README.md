# Integration / E2E tests

These tests boot the **real** `AppModule` and exercise the booking critical path
end to end against real infrastructure:

- **Postgres** (`docker compose up -d postgres`) — real schemas and migrations.
- **RabbitMQ** (`docker compose up -d rabbitmq`) — real outbox relay + consumer,
  so cross-module events (settlement, refund, income release) flow as in
  production.
- **Jitsi** (optional; `docker compose up -d jitsi-web jitsi-prosody jitsi-jicofo jitsi-jvb`)
  — the Jitsi spec verifies the API issues Prosody-compatible JWTs. It
  **self-skips** when Jitsi is not reachable, so CI can run without it.
- **S3/MinIO** (optional; `docker compose up -d minio minio-init`) — the S3 spec
  uploads to the real bucket via the API's pre-signed URL and **self-skips**
  when no S3 endpoint is reachable. Objects persist in the `minio-data` volume.
- **Payment** needs no external service: the specs post a **SePay IPN body** directly
  to `POST /api/wallet/top-ups/callback` and let the wallet settle it (ADR-033). The
  harness also replaces the outbound checkout redirect with a stub, so no live call
  to SePay is made and the suite runs offline. The IPN receiver, the settlement and
  the ledger effects stay real.

## Running

```bash
docker compose up -d postgres rabbitmq minio minio-init   # + jitsi-* for the Jitsi spec
cp .env.example .env
pnpm keys:gen
pnpm --filter @skillswap/contracts build
pnpm --filter @skillswap/api build          # migrate reads dist/
pnpm db:migrate
pnpm test:e2e
```

`pnpm test:e2e` runs `apps/api/jest.e2e.config.cjs` (matches `test/**/*.e2e-spec.ts`,
serial). The normal `pnpm test` / `pnpm verify` **exclude** `test/`, so CI's unit
gate stays fast; a separate CI `e2e` job provisions Postgres + RabbitMQ and runs
this suite.

## What is covered

`booking-flow.e2e-spec.ts`:

- Happy path: register → top-up → publish class → book → confirm (settle) →
  room access (window + party checks) → complete → **income release** →
  wallet history reconciles to the balance.
- AC-005: confirming with an empty balance leaves no partial wallet state.
- AC-026: an expired hold is swept to `cancelled` and releases the seat.
- AC-024: a teacher no-show refunds the learner.
- Idempotency: replaying a top-up callback credits exactly once.

`jaas-room-access.e2e-spec.ts`:

- The API issues a tenant-scoped RS256 room token and returns a `url` naming the same
  `<appId>/<room>` the token is scoped to (ADR-039). A mismatch opens a room in no tenant.
- The token's signature verifies against the configured key; `moderator` is the string
  `"true"`/`"false"` and a Learner is never a moderator.
- Self-skips when `JITSI_APP_ID` / `JITSI_PRIVATE_KEY_PATH` are unset (`pnpm keys:gen` writes
  a placeholder key).

`cloudinary-document.e2e-spec.ts`:

- The API's signed multipart target is accepted by the real Cloudinary account, and the
  document row is `attached` after submission.
- Skips unless `CLOUDINARY_E2E=true` and real `CLOUDINARY_*` credentials are present, so an
  ordinary `pnpm test:e2e` stays offline.

`room-idle.e2e-spec.ts` / `room-idle-payment.e2e-spec.ts`:

- Presence deliveries are signed the way JaaS does (`X-Jaas-Signature` over the raw body), so
  the specs exercise the real verification path rather than a re-serialised approximation.

## Notes

- Tests truncate the touched schemas before each case; run against a dev database.
- `apps/api/test` may import module internals (allowed in `.dependency-cruiser.cjs`)
  so a test can nudge a scheduler deterministically instead of waiting on a timer.
