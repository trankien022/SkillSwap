# T03 server storage/payment spike — 12 October 2026

- Strengthened existing S3 E2E with visible unavailable skip and S3_REQUIRED=true forcing execution/failure. Tests use existing Node SigV4 signing pattern, no added SDK/dependency.
- Actual presigned PUT to MinIO succeeded; separately signed GET returned 200, application/pdf and identical uploaded bytes; student verification submission attached persisted document metadata.
- Existing booking-flow E2E exercises mock provider HMAC callback server-side, actual Postgres wallet/ledger settlement and RabbitMQ/outbox effects, completion/release and cancellation/refund assertions. Signing credential remains server/test-side.
- S3_REQUIRED=true pnpm --filter @skillswap/api test:e2e -- s3-document.e2e-spec.ts booking-flow.e2e-spec.ts: 2 suites/6 tests passed; no skipped storage test. Log /tmp/skillswap-mobile-storage-wallet-e2e.log.
- This proves server/infrastructure behavior with disposable fixtures. Phone upload, payment UI reconciliation and two-device Jitsi call still pending; T03/T08 remain unchecked as complete tasks.
