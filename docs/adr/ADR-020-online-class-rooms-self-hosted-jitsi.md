# ADR-020: Online class rooms — self-hosted Jitsi with JWT auth

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-10

**Context.** FR-011 requires that a Learner or Teacher of a booking can join the correct online room around the scheduled time, that a non-party is denied (AC-006), and that the system fails with a clear status and an audit trail when the room provider is unavailable (NFR-006/NFR-009). Today nothing exists: no Jitsi references in `apps/`, no room concept, and no provider configured. Postgres already runs in the backend Docker stack (`docker-compose.yml`), so the "run it ourselves" precedent is set.

Two decisions shape the increment: where the video service runs, and how access is authorized.

**Decision.**

1. **Self-hosted Jitsi in the backend Docker stack.** `docker-compose.yml` gains a Jitsi deployment (`web`, `prosody`, `jicofo`, `jvb`) alongside the existing `postgres` and `rabbitmq`. This keeps the whole backend runnable with one `docker compose up -d` and avoids a third-party SaaS dependency for the MVP.
2. **JWT-authenticated rooms (`ENABLE_AUTH=1`, `AUTH_TYPE=jwt`).** Prosody is configured to accept JWTs signed with an app id (`JITSI_APP_ID`) and a shared secret/app key. The API is the only token issuer: it signs a **short-lived** HS256 JWT scoped to one room with the user's role (`moderator` for the Teacher, `participant` for the Learner).
3. **The API issues room tokens; the client never talks to Prosody directly.** `POST /api/classes/bookings/:bookingId/room-access` (auth required) returns `{ room, token, expiresAt, url }`. The room name is **deterministic and non-guessable**: `skillswap-<classId>` (a UUID), never PII; the token is what actually gates entry.
4. **Authorization is re-checked on every request (stateless tokens).** The use case loads the booking and class, confirms the requester is one of the two parties and that the booking is `confirmed`, then applies the **access window**: open `JITSI_OPEN_MINUTES` before `starts_at`, close at `starts_at + duration`. Tokens are short-lived (`JITSI_TOKEN_TTL_SECONDS`), so a cancelled or rescheduled class simply stops issuing valid tokens — no denylist.
5. **Provider unavailability is explicit.** If the issuer/health check fails, the endpoint returns `503` with a trace id and persists a room-access incident so NFR-006/NFR-009 have an audit trail.

**OQ-008 reconciliation.** OQ-008 concerns verification-value retention/expiry cascades; its room-access clause is the "room access after a class is cancelled/rescheduled or a user's status changes" case. That is handled here as **cascade**: because tokens are short-lived and the party+window+state checks run on every request, cancelling a class or rescheduling it (which the AC-017 edit-lock forbids once a booking is confirmed) immediately changes what the next request is allowed to do. No grandfather exception applies in the MVP.

**Rationale.** Self-hosting matches the existing Docker-based backend and keeps the auth model entirely inside our trust boundary. Signing our own JWT means the API already owns identity (ADR-016), roles, and booking state, so room authorization is the same check as every other booking operation. A deterministic room name plus a scoped, short-lived token satisfies AC-006 without exposing anything enumerable.

**Consequences.**

- (+) The whole backend, including video, is `docker compose up -d`; no SaaS account or external secret.
- (+) Room access reuses the booking/identity the platform already trusts; one place issues tokens.
- (+) Failures are visible (503 + trace) rather than silent.
- (−) The MVP must run the multi-container Jitsi stack (web/prosody/jicofo/jvb); it is heavier than a hosted JaaS endpoint.
- (−) Dev TLS/DNS for Jitsi is fiddly; the compose service is configured for local development, not hardened for production (a follow-up hardening task).
- (−) Deferred: recording, moderation, lobby, attendance analytics.

**Verification.**
- Unit: `RoomAccessPolicy` denies non-parties and cancelled bookings and enforces window boundaries; the token issuer sets `moderator` only for the teacher and a short `exp`.
- Use case: a party within the window gets a token; an outsider/closed window is refused; an issuer failure yields 503 + a persisted incident.
- Compose: `docker compose config` validates; Jitsi services are present with JWT auth env.
- Architecture tests stay green.
