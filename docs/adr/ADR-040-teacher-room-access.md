# ADR-040 — Teacher room access is authorised on the class, not on a booking

**Status:** Accepted. Amends [ADR-020](ADR-020-online-class-rooms-self-hosted-jitsi.md)
decision 2 (party authorisation is per request) and [ADR-039](ADR-039-hosted-jaas-class-rooms.md)
decision 5 (presence feed — unchanged, but now reachable for the teacher).
**Date:** 2026-11-10
**Level:** Software (C4 Level 3 · Component)

**Context.** FR-011 requires the system to grant *the Learner and Teacher* of a booking access to
the correct room within the permitted window. `authorizeRoomAccess` already rewards the teacher with
`moderator` when `requesterId === classView.teacherId`, so the domain supports the second party. The
only published entry point is, however, `POST /classes/bookings/:bookingId/room-access`, and it is
keyed by a **booking** id.

A teacher has no booking for the class they teach. In the web client the consequence is total:
`LiveClassroomContent` resolves its booking from `GET /classes/bookings/me`, which the controller
scopes to `learnerId: currentUserId` without an override. A logged-in teacher therefore receives
`Session not found`, and there is no other route, no roster read, and no button. `Start` moves the
class to `in_progress` and then strands it: the class leaves the public marketplace and the teacher
still cannot enter.

Two facts make the class the correct aggregate to authorise against:

1. The room name is `skillswap-<classId>` — already a class fact, not a booking fact.
2. The access window is `startsAt - openMinutes` … `startsAt + durationMinutes` — both class
   columns.

The booking id appears in the learner route because a *learner's* eligibility really does depend on
their own booking being `confirmed`. For the teacher that dependency is spurious: it requires a row
that does not exist, for a guard that does not apply.

The consequence is not only a missing screen. Teacher no-show (FR-020) is decided from
`class_presence`:

```ts
const teacherJoinedAt = await this.presence.findTeacherFirstJoin(classView.id, classView.teacherId);
```

A teacher who cannot join cannot write presence, so any learner could mark them absent and take the
refund. The feature is not merely incomplete — it is unsafe to leave in this state.

**Decision.**

1. **Teacher room access is authorised on the class.** New endpoint
   `POST /classes/:id/room-access`. The requester's identity comes from the verified JWT only; no
   teacher id is accepted from the body.

2. **The booking-keyed endpoint is unchanged.** `POST /classes/bookings/:bookingId/room-access`
   remains for learners and mobile, and keeps its `confirmed`-booking guard, which is correct there.

3. **Teacher joinability is a class-state rule**, not a booking-state rule. Allowed:
   `published`, `full`, `in_progress`. Denied: `draft` (never announced), `completed` (the session
   is over; re-entry is a dispute concern, not a room concern), `cancelled` (the projector has
   refunded). A new denial reason `class_not_joinable` carries this on the wire so clients branch on
   a code, never on prose.

4. **The window arithmetic is shared, not re-implemented.** The teacher path calls the same
   `windowBounds` helper as the learner path. Two definitions of the window drift, and the drift is
   invisible until someone is locked out of their own class.

5. **The teacher receives `moderator`** through the existing `RoomTokenIssuer` port. JaaS's
   `moderator: "true"` claim already derives from the role, so no provider contract changes.

6. **Teacher class membership is read, never joined across schemas.** The roster read
   (`GET /classes/:id/roster`) selects from `live_class.bookings` and resolves display names through
   `account-profile`'s `PublicProfileReader` facade, per ADR-014. The existing `sql-*.spec.ts` guards
   that assert the SQL never contains `account_profile` continue to apply.

7. **The web client gets a separate teacher route**, `/{locale}/teach/classes/[id]/live`, rather
   than reusing the learner page with a booking id. The learner page is typed around escrow, rating
   and post-session review; those are the learner's money actions and must not be rendered to the
   teacher.

**Consequences.**

- The teacher can start and *attend* a class, which makes `class_presence` populated for the teacher
  and makes FR-020's no-show rule meaningful rather than a liability.
- A `moderator` token can end a conference. Authorisation is therefore read from the class row
  (`classView.teacherId`), never from request input; the negative-control test asserts a non-owner
  teacher is refused.
- `in_progress` is no longer a terminal mistake for the teacher path: the window still governs
  entry, so starting early does not open the room early.
- The learner path is untouched, so its published contract and tests do not move.
