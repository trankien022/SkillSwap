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
  when no S3 endpoint is reachable.
- **Payment** is the mock gateway (per ADR-017).

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

`jitsi.e2e-spec.ts`:

- Jitsi advertises JWT auth (anonymous + auth domains).
- The API issues a valid HS256 room token (correct `aud`/`iss`/`room`/
  `context.user.moderator`, signature verifiable with the shared secret).

`s3-document.e2e-spec.ts`:

- The API's pre-signed PUT (SigV4) is accepted by the real S3 service; the
  object lands in the bucket and the document row is `attached` after submission.
- Self-skips when no S3 endpoint is reachable (e.g. MinIO not started).

## Notes

- Tests truncate the touched schemas before each case; run against a dev database.
- `apps/api/test` may import module internals (allowed in `.dependency-cruiser.cjs`)
  so a test can nudge a scheduler deterministically instead of waiting on a timer.
