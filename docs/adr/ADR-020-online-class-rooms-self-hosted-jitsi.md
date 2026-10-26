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

---

## Amendment A (2026-10-26) — inbound presence feed

**Context.** AC-035 lets a class complete once everybody has left the room for a grace period, which needs the server to know who is in the room. Until now nothing inbound ever told the API that. This amendment records how that feed is trusted and what a payload is allowed to affect.

**Decision.**

1. **Presence arrives by webhook, authenticated by a shared secret header** (`x-jitsi-webhook-secret`, served at `POST /api/internal/jitsi/presence`). Not by source IP: self-hosted Jitsi may sit behind any proxy, so an allow-list would be fragile and would provide no real assurance. If the secret is unset the endpoint refuses **every** request, so a misconfigured deployment cannot have its classes closed by outsiders.
2. **Occupancy is party-only.** An event is applied only when the room name resolves through `roomName()` to a real class **and** the occupant id is that class's Teacher or a learner holding a confirmed booking. Anyone else is acknowledged and ignored — a stranger who guesses a room name must not be able to keep a class looking occupied, nor to be the last departure that completes it.
3. **Identity comes from the token, not the display name.** The occupant is the `context.user.id` claim of the token issued at `request-room-access`, which is why two participants cannot be confused with each other.
4. **Sessions, not a boolean.** `class_presence` holds one row per participation session (`joined_at`, `left_at`, null while present), with a partial unique index allowing one open session per (class, participant). A redelivered join is a no-op; a leave with nothing open is ignored rather than invented; a re-join correctly makes the room occupied again.
5. **A webhook is always acknowledged.** Well-formed events return 200 even when they change nothing, because a non-2xx makes Jitsi retry an event that will never become valid. A malformed body also returns 200 with `accepted: false`.
6. **Missing data is unknown, never empty.** If the feed is down, no rows are written, and the idle rule declines to fire; classes fall back to `scheduled_end`.

**Consequences.**

- (+) Early completion rests on evidence the server holds, not on a caller's claim — which also closes AC-024: the no-show decision now reads the Teacher's first join from `class_presence` instead of accepting `teacherJoinedAt: null`.
- (−) Presence is only as good as the Jitsi webhook integration; the self-hosted stack needs `event_sync` configured with the shared secret. Until that is installed in a given environment, every class completes on `scheduled_end` — the documented degradation, not a gap.
- (−) Room tokens are short-lived (ADR-020 §4), so a participant may legitimately have no presence row if their join event was missed; that under-reports presence, which can delay an idle completion but cannot cause an early one.

**Verification.**
- Domain: `evaluateRoomIdle` truth table, including before-`starts_at` (always false, even with zero participants), teacher-left-but-learner-stayed, and unknown presence.
- Controller: missing, wrong, prefix-matching and unconfigured secrets all refuse; unknown rooms and malformed bodies change nothing.
- Use case and E2E: a stranger's join/leave leaves no row; redelivered events are idempotent; an idle room completes with `room_idle` and releases the Teacher's income; an occupied room, an unstarted class and a silent feed all do not.
- CI (added 2026-10-26, after a real CI failure): the workflow exports `JITSI_WEBHOOK_SECRET`, because CI copies `.env.example`, where the secret is deliberately blank — without the export every webhook is refused and the room-idle suites fail. The E2E specs no longer fall back to a guessed secret: an unset one now fails with a message naming the variable, since a guess signs requests with a value the server never loaded and turns one configuration error into nine confusing 401s.
