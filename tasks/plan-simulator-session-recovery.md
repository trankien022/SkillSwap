# Plan: iOS Simulator session recovery

## Problem

In the iPhone 17 Pro Simulator, a persisted refresh token with a deleted or unknown account receives HTTP 404 from the Gateway/API (`Account not found`). `SessionService.restoreSession()` treats only 401 as an authentication rejection, so it preserves that unusable credential and shows the generic connection-error screen on every launch. The app can reach the Gateway; this is stale-session handling, not a transport outage.

## Phases

1. **Classify terminal refresh responses** — complete. Refresh `401` and the specific `404 Account not found` clear the unusable session; transport failures, 5xx responses, unrelated 404s, and storage failures remain visible. Added focused tests for both 404 branches and retained outage coverage.
2. **Verify in Simulator** — complete. iPhone 17 Pro showed the stale refresh request returning `404 Account not found`; after the Expo bundle update it cleared that session and reached the Vietnamese login screen. Gateway and API health returned `ok` with the database up. `apps/mobile/.env` points the simulator to the Mac LAN address and is ignored by Git.
3. **Record evidence** — complete. Focused session tests, mobile typecheck, full `pnpm verify`, `git diff --check`, and `graphify update .` passed. Implementation and this plan are committed separately.

## Acceptance

- A refresh 404 clears only the unusable local session and lets the app continue signed out.
- Network errors and 5xx responses do not clear stored credentials.
- Simulator displays the authentication entry screen instead of the connection error.
- No production database, remote service, or physical device is changed.

## Verification result

- `apps/mobile/src/application/session-service.spec.ts`: 24/24 tests passed.
- `pnpm verify`: passed; API 532, mobile 179, contracts 143, Gateway 27, web 22; architecture gate passed (644 modules / 1,935 dependencies).
- `git diff --check`: passed.
- `graphify update .`: completed (5,046 nodes / 12,402 edges / 205 communities).
