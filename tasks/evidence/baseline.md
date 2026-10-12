# Baseline verification — 12 October 2026

Workspace: mobile-rubric worktree, base source commit 1ed36e8.

- `pnpm install --frozen-lockfile`: passed before mobile dependencies changed.
- `pnpm verify`: passed before implementation; API 71 suites / 360 tests and architecture 489 modules / 1426 dependencies with no violations. Log: /tmp/skillswap-mobile-baseline-verify.log.
- Local container runtime provisioned using Colima. PostgreSQL 17, RabbitMQ 3.13 and MinIO reported healthy.
- Existing migrations applied successfully to all seven schemas. Log: /tmp/skillswap-mobile-migrate.log.
- `pnpm test:e2e`: passed 10 suites / 29 tests against PostgreSQL/RabbitMQ/MinIO. Optional Jitsi availability logic is not a two-device call verification; Jitsi stack was not yet running when this baseline began. Log: /tmp/skillswap-mobile-baseline-e2e.log.
- iPhone 17 Pro simulator booted. A physical iPhone appears in device discovery but is unavailable to this host; no physical-device push/call proof yet.

This baseline proves the starting backend and available local infrastructure, not completion of mobile tasks. T02/T03 physical-device acceptance and the final plan remain incomplete. Local signing/JWT fixture generation used ignored .env/.secrets files; no credentials are included in this evidence.

## Follow-up runtime checks

- User confirmed iPhone as the primary acceptance device, and no paid Apple Developer membership or Expo/EAS project yet. Simulator/local build work can proceed; APNs remote-push and physical-device acceptance remain pending. Local Xcode signing with a personal Apple ID is a possible route for on-device app testing, separate from remote-push entitlement.
- Real Gateway authentication sequence passed: register → authenticated me → rotated refresh → logout → revoked refresh rejected with 401. API process runs with AUTH_MODE=strict and Gateway with AUTH_REQUIRED=true; permissive default development auth cannot prove bearer identity. Disposable fixture credentials are not included or retained here.
- Initial mobile Slice A verification found TypeScript Error.cause override errors; supervisor review also identified storage/logout races and Expo environment inlining issues. Worker corrections and regression tests are in progress; this slice is not yet accepted.
