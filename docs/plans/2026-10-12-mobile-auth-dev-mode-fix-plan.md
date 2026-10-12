# Mobile authenticated API requests — fix plan

## Root cause

The active local environment sets `AUTH_REQUIRED=false` for the Gateway and `AUTH_MODE=off` for the API. In this mode the Gateway deliberately ignores mobile bearer tokens and does not forward verified `x-user-*` identity headers. The API consequently treats protected requests as `anonymous`; for example, `GET /api/classes/bookings/me` returns `401 Authentication required`. The mobile UI catches that response and labels it as a connectivity failure.

## Phases

1. **Align local development authentication defaults** — set `AUTH_REQUIRED=true` and `AUTH_MODE=strict` together in `.env.example` and the ignored local `.env`; retain the existing RS256 key pair and mobile Gateway URL.
2. **Restart and verify the backend path** — restart API and Gateway so they load the coordinated switches; verify health, valid public auth routes, and protected-route identity forwarding.
3. **Verify on iOS Simulator** — reload the installed mobile app, confirm the dashboard and bookings summary no longer show the false connection error, then run `pnpm verify` and refresh Graphify.

## Acceptance criteria

- The Gateway validates the app's bearer token and forwards the matching trusted identity.
- The API accepts the forwarded identity in strict mode; protected business requests do not resolve to `anonymous`.
- A genuinely invalid session remains an authentication error and does not get mislabeled as a network outage.
- Health/auth public routes continue to work and the repository verification gate passes.
