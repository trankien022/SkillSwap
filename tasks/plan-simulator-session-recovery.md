# Plan: iOS Simulator session recovery

## Problem

In the iPhone 17 Pro Simulator, a persisted refresh token with a deleted or unknown account receives HTTP 404 from the Gateway/API (`Account not found`). `SessionService.restoreSession()` treats only 401 as an authentication rejection, so it preserves that unusable credential and shows the generic connection-error screen on every launch. The app can reach the Gateway; this is stale-session handling, not a transport outage.

## Phases

1. **Classify terminal refresh responses** — treat 401 and 404 from the refresh operation as invalid sessions, clear persisted credentials, and return to the signed-out state. Preserve credentials and surface errors for transport failures, 5xx responses, and storage failures. Add focused tests for 404 recovery and existing outage preservation.
2. **Verify in Simulator** — rebuild/reload the Expo development client on iPhone 17 Pro; confirm the stale credential is cleared and the app reaches login. Confirm Gateway/API health and keep the local Expo API URL ignored from Git.
3. **Record evidence** — update the mobile task checklist with the observed simulator outcome, run the focused test and `pnpm verify` if source changed, then commit implementation separately from this plan.

## Acceptance

- A refresh 404 clears only the unusable local session and lets the app continue signed out.
- Network errors and 5xx responses do not clear stored credentials.
- Simulator displays the authentication entry screen instead of the connection error.
- No production database, remote service, or physical device is changed.
