# Room presence and early completion — defects found while verifying the JaaS webhook

**Status:** implemented (see §As built)
**Date:** 2026-11-10
**Scope:** `apps/api` live-class module, `ApiConfig`, ADR-021 amendment, docs
**Supersedes nothing.** Amends ADR-021 (early-completion half).

## Why this exists

The task was "verify the JaaS webhook handles the exact events 8x8 returns, and make an
emptied room close the class". Verifying the vendor contract (8x8 developer docs, read
2026-11-10) answered the second half differently than expected — the rule already exists —
and turned up four defects on the way.

The vendor contract itself is mostly correct as shipped: `X-Jaas-Signature` with
`t=<ts>,v1=<sig>`, HMAC-SHA256 over `"<ts>.<raw body>"` base64-encoded, verified against
the **raw** body; `eventType` `PARTICIPANT_JOINED` / `PARTICIPANT_LEFT`; `fqn` of the form
`[AppID]/[room name]`; identity at `data.id` = JWT `context.user.id`. All confirmed against
`developer.8x8.com/jaas/docs/webhooks-{payload,signatures}`.

## Defect 1 — a pre-start departure completes the class at `starts_at` (money)

`evaluateRoomIdle` gates on `now >= startsAt` but never asks **when the participants left**.
The room opens `JITSI_OPEN_MINUTES` (15) early, so:

1. Teacher opens the room at `starts_at − 15m` to test their camera.
2. Teacher leaves at `starts_at − 10m`.
3. At `starts_at` the next sweep sees "started" and "everyone gone for 10 min > 5 min
   grace" and completes the class with basis `room_idle`.

That publishes `class.completed` and releases the Teacher's pending income for a session
that never ran, while the Learner is refunded nothing. ADR-021 Amendment A intended the
exact opposite ("No code path can complete a class before `starts_at`") — the check
satisfies that by the letter and violates it in effect.

Proven, not inferred: a probe asserted `{ idle: true, reason: 'idle' }` at `starts_at` with
a single session that joined and left during the early-open window.

**Fix.** The clock starts when the class does: a departure only counts if it happened at or
after `starts_at`. Sessions that ended entirely before the start are treated as having
ended at `starts_at`, so the full grace still has to elapse after the class begins.

## Defect 2 — a departure is ignored when the booking is no longer `confirmed`

`RecordPresenceUseCase` resolved parties from
`findActiveByClass(...).filter(state === 'confirmed')`, and `interpretPresenceEvent`
rejects anyone who is not a party. So a Learner whose booking is cancelled mid-class stops
being a party, their `PARTICIPANT_LEFT` returns `not_a_party`, their session row keeps
`left_at IS NULL` forever, and `evaluateRoomIdle` sees a permanently occupied room. The
class can then only ever close at `scheduled_end`.

**Fix.** Join stays a party check (a stranger must not create presence). Leave only requires
that the room is ours and that the account has an open session — a departure is evidence
about the room, not a claim about entitlement. A leave with no open session stays a no-op,
so the existing anti-stranger tests keep their meaning.

## Defect 3 — `ROOM_DESTROYED` is discarded

8x8 documents `ROOM_DESTROYED` as fired "after all of the participants have left". The
controller mapped only two event types, so it fell through to `unknown_room` and was
acknowledged into nothing.

**Deliberately not used to complete the class.** JaaS creates a room on first join and
destroys it when the room empties, so a 40-second WiFi drop produces
`PARTICIPANT_LEFT` → `ROOM_DESTROYED` → `ROOM_CREATED` on reconnect. Completing on that
signal would end a 60-minute class at minute 2 and release escrow irreversibly (ADR-021
§5), with the Learner still in the call. The 8x8 docs name this case:
`disconnectReason: "unknown"` — "a participant experienced a connection issue".

The event carries no information about emptiness that the last `PARTICIPANT_LEFT` does not.
Its real value is fault tolerance: presence is *inferred* from N deliveries, so one lost
`PARTICIPANT_LEFT` leaves a row open forever and the class silently never completes early.
`ROOM_DESTROYED` arrives regardless and closes every open session at once, subject to the
same `starts_at` floor as Defect 1.

Closing presence rows is reversible — a reconnect opens a new row. Completing a class is
not. That asymmetry is the whole decision.

## Defect 4 — the grace period is hardcoded

`ROOM_IDLE_GRACE_MINUTES = 5` with no configuration, unlike `JITSI_OPEN_MINUTES`.
`evaluateRoomIdle` accepts `graceMinutes` but only one test passes it; the sweeper never
does.

**Fix.** `ROOM_IDLE_GRACE_MINUTES` read from the environment through a **new** reader.
`readInt` rejects `<= 0`, so it cannot express the requested "0 must work":

```ts
function readNonNegativeInt(name: string, fallback: number): number
```

`0` disables the grace (complete on the first sweep after the last departure); a negative or
non-numeric value still fails loudly at boot, because silently coercing a typo to a valid
number is how a money path acquires an unintended rule. Default stays `5` (W1 C3a).

## Phases

| # | Phase | Failing test written first |
|---|---|---|
| 1 | Plan document (this file) | — |
| 2 | `ADR-021 Amendment D` + config | `readNonNegativeInt` accepts `0`, rejects `-1` |
| 3 | Idle rule counts only departures at/after `starts_at` | pre-start join+leave at `starts_at` → must not be `idle` |
| 4 | Leave no longer requires a current booking | cancel booking mid-class, send leave → `left_at` set, `room_idle` fires |
| 5 | `ROOM_DESTROYED` closes open sessions | drop a `PARTICIPANT_LEFT`, send `ROOM_DESTROYED` → stale row closes |
| 6 | Wire `ROOM_IDLE_GRACE_MINUTES` into the sweeper | configured value honoured; `0` completes on the first sweep |

## Verification

- `presence.spec.ts` — truth table, plus the pre-start rows.
- `record-presence.use-case.spec.ts` — cancelled-booking departure.
- `jitsi-presence.controller.spec.ts` — `ROOM_DESTROYED` routing, signature on it.
- `complete-elapsed-classes` — grace `0` completes immediately; grace honoured otherwise.
- `api-config.spec.ts` — `0` accepted, negative rejected.
- `pnpm` steps run directly (registry unavailable in this environment): lint, typecheck,
  api tests, arch rules.

## As built

| Planned | Actual |
|---|---|
| New `readNonNegativeInt` | as planned, plus `ApiConfig.jitsiIdleGraceMinutes` |
| Departure floor at `starts_at` | as planned; sessions ending before the start are clamped to `starts_at` rather than dropped, so the grace still runs |
| Leave ignores booking state | as planned; `recordLeave` port already closed only the newest open row |
| `ROOM_DESTROYED` recovery | as planned; `PresenceSessionClosedByRoomDestroyed` keeps the floor and does not complete |
| Grace wired to the sweeper | as planned; injected as a constructor argument, defaulted so existing callers are untouched |
