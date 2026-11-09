---
title: Teacher can join the live class room (FR-011)
type: plan
date: 2026-11-10
topic: teacher-join-live-class
status: Proposed
owner: Group 4
---

# Teacher can join the live class room (FR-011)

**FRs:** FR-011 (learner *and teacher* join the class room), FR-012 (chat shares the room window),
FR-020 (teacher no-show is decided from presence) · **ACs:** AC-006 (only parties join),
AC-024 / AC-035 (no-show reads join evidence, never a caller's claim)
**Modules:** `live-class` (domain → application → adapters), `apps/web`, `packages/contracts`
**Relates to:** ADR-016 (identity), ADR-020 (room naming, per-request re-authorisation),
ADR-036 (chat window == room window), ADR-039 (JaaS) · **New:** ADR-040

---

## 0. Why

`FR-011` in the SRS reads:

> The system shall grant the Learner **and Teacher** of a booking access to the correct Jitsi room
> within the permitted time window.

The API honours the teacher half. `authorizeRoomAccess` returns `moderator` when
`requesterId === classView.teacherId`. **The web client never asks.** There is no teacher-facing
room entry anywhere in `apps/web`, so the requirement is half-implemented.

### Evidence (reproduced against the deployed build, 2026-11-09/10)

Logged in as `user1@demo.skillswap.local` (teacher of both seeded classes):

| Surface | What the teacher gets |
|---|---|
| `/{locale}/instructor` class card | `edit Edit`, `play_arrow Start` — **no join action** |
| `POST /classes/:id/start` | succeeds (`published\|full → in_progress`), and that is the end of the flow |
| `/{locale}/bookings/<learnerBooking>/live` (the only live route) | `Session not found — This session is no longer in your bookings.` |

Why it fails, in one line each:

- `apps/web/src/app/[locale]/bookings/[id]/live/page.tsx` is the **only** room route, and
  `LiveClassroomContent` resolves the booking from
  `GET /classes/bookings/me` (`LiveClassroomContent.tsx:107`).
- That endpoint is hard-scoped: `learnerId: currentUserId(request)`
  (`my-bookings.controller.ts:79`). A teacher has no `bookings` row for their own class.
- No endpoint lists the bookings of a teacher's class, so the teacher cannot even discover a
  booking id to try.
- `GET /classes?teacherId=me` returns classes, not bookings.

### Two consequences that make this more than a missing button

1. **Money.** Teacher no-show is decided from `class_presence`, not from a claim:

   ```ts
   // mark-teacher-no-show.use-case.ts:40
   const teacherJoinedAt = await this.presence.findTeacherFirstJoin(classView.id, classView.teacherId);
   ```

   A teacher who cannot join can never write presence, so a learner can mark them absent and
   receive the refund. FR-020 is unusable until this is fixed.

2. **`in_progress` is a dead end.** `Start` moves the class to `in_progress`, which hides it from
   the public marketplace (`get-class-detail.query.ts:62`) and pre-empts the room window. The
   teacher's only "begin the class" action currently strands the class.

### Why the fix is not "add a button"

Adding a button that reuses `/bookings/<id>/live` would require handing the teacher a **learner's
booking id** and would still render the learner's viewpoint (the teacher would appear as
"peer student", with the learner's escrow and rating actions). The room and its time window are
**class-level** facts, so the teacher's authorisation belongs on the class. That is a contract
change, hence ADR-040.

---

## 1. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Teacher room access is authorised on the **class**, via a new `POST /classes/:id/room-access`. | The room is `skillswap-<classId>` and the window is `startsAt ± duration` — both class facts. A teacher has no booking row, and inventing one to satisfy a signature is the bug, not the fix. |
| D2 | The existing `POST /classes/bookings/:bookingId/room-access` is **untouched**. | It is published, used by the learner page and mobile, and its booking-state guard is correct for learners. |
| D3 | Teacher joins get `role: moderator` through the same `RoomTokenIssuer` port. | No provider change; JaaS `moderator: "true"` already comes from the role. |
| D4 | Joinability for a teacher is a **class-state** rule: allowed for `published`, `full`, `in_progress`; denied for `draft`, `completed`, `cancelled`. | A teacher must not open a room for a class that was cancelled or already finished, and `draft` was never announced. |
| D5 | The window is the **same** `DEFAULT_OPEN_MINUTES` / duration arithmetic, reused from `isWithinAccessWindow`. | Two window definitions drift, and a drifting window is undetectable until someone cannot join. |
| D6 | A new denial reason `class_not_joinable` joins `ROOM_ACCESS_DENIALS`. | The client branches on stable codes, never on prose (`room-access-client.ts` header comment). |
| D7 | New read `GET /classes/:id/roster` returns the class's active bookings + learner display names, teacher-only. | Needed for the teacher's participant panel and to show "who is enrolled". Names come from `account-profile`'s `PublicProfileReader` facade — **never a cross-schema join** (ADR-014). |
| D8 | The teacher gets its **own** route `/{locale}/teach/classes/[id]/live`. | The learner page is typed around a booking (escrow, rating, "Finish Class"). Mirroring is honest; overloading is not. |

---

## 2. Phases

Each phase is its own commit and leaves the tree green (`pnpm verify`).

### Phase 0 — Docs: ADR-040 + this plan

New `docs/adr/ADR-040-teacher-room-access.md`:

- Records that FR-011's teacher half is authorised on the class, not on a booking.
- Amends ADR-020 decision 2 (party authorisation) and ADR-039 decision 5 (presence unchanged).
- States the class-state joinable set and why `in_progress` is included.
- Notes that presence, and therefore no-show, now becomes achievable.

Also record the open question in the plan: the seeded "LIVE NOW" bookings exist, but **no demo
class is inside its window at test time**, so the E2E demo must create one.

Commit: `docs(live-class): record teacher room access decision`

### Phase 1 — Domain: teacher authorisation on a class

`apps/api/src/modules/live-class/internal/domain/room-access.ts`

- Add `'class_not_joinable'` to `ROOM_ACCESS_DENIALS`.
- Add `TEACHER_JOINABLE_CLASS_STATES = ['published', 'full', 'in_progress']`.
- Add `authorizeTeacherRoomAccess(request)`, reusing `windowBounds`/`roomName`:

  ```ts
  export interface TeacherRoomAccessRequest {
    classView: RoomAccessClass & { id: string; state: ClassState };
    requesterId: string;
    now: Date;
    openMinutes?: number;
  }
  ```

  Denials in this order: `not_a_party` → `class_not_joinable` → `window_not_open` → `window_closed`.
  Returns `{ room: roomName(classView.id), role: 'moderator' }`.

Tests (`room-access.spec.ts`): non-teacher denied; each non-joinable state denied; before-window and
after-window denied; moderator granted inside the window; **room equals `roomName(classId)`** and
equals what the learner path produces for the same class (this is the assertion that keeps the two
entry points in one room).

Commit: `feat(live-class): authorise teacher room access on the class`

### Phase 2 — API: `POST /classes/:id/room-access`

- `application/port/in/request-teacher-room-access.ts`
- `application/request-teacher-room-access.use-case.ts` — mirrors `RequestRoomAccessUseCase`:
  read class → `authorizeTeacherRoomAccess` → `RoomTokenIssuer.issue` → same incident recording and
  `RoomUnavailableError` handling on `RoomProviderUnavailableError`.
- `classes.controller.ts` — new handler, `ParseUUIDPipe`, `currentUserId`, **no teacher id from the
  body** (identity comes from the verified JWT).
- Register in `live-class.module.ts`.
- Reuses `RoomAccessResponseDto` — the wire shape is identical, so `packages/contracts` is unchanged
  for this phase.

Tests: use-case spec (grants moderator, propagates denials, records an incident on provider
failure); controller spec (anonymous → 401; non-owner teacher → 403; owner → 200).

Commit: `feat(live-class): expose teacher room access endpoint`

### Phase 3 — API: `GET /classes/:id/roster`

- `application/port/out/class-roster-reader.ts` + `sql-class-roster-reader.ts` reading
  `live_class.bookings` only (`id`, `learner_id`, `state`, `created_at`) — **no `account_profile`
  join**, matching the existing `sql-*.spec.ts` guards that assert the SQL never contains
  `account_profile`.
- Display names via the existing `AccountProfilePublicTeacherReader` pattern (a thin
  `ClassRosterLearnerReader` over `PublicProfileReader`), because the facade is id-based, not
  role-specific.
- `application/query/get-class-roster.query.ts`, teacher-only: `callerId === teacherId`, else 404
  (not 403 — do not confirm the class exists to a stranger, consistent with
  `get-class-detail.query.ts:55`).
- Contract `classRosterSchema` in `packages/contracts` (new), Zod-parsed at the boundary.
- Only `active` bookings (`pending` with a live hold, `confirmed`) appear, so a cancelled seat does
  not look enrolled.

Tests: query spec (teacher-only, name enrichment, empty roster), SQL spec (no `account_profile`),
contract spec.

Commit: `feat(live-class): add teacher class roster read`

### Phase 4 — Web: teacher can reach and enter the room

- `lib/classroom/room-access-client.ts`: add `requestTeacherRoomAccess(classId, displayName)` and a
  `reasonForFailure` case for `'Teacher cannot open a room for this class state'` →
  `'class_not_joinable'`; extend `RoomAccessReason`.
- New route `app/[locale]/teach/classes/[id]/live/page.tsx` → `TeacherLiveClassroomContent`.
- `app/[locale]/instructor/page.tsx`: add a **Join room** action on cards where the class is
  `in_progress`, or `published|full` inside the window. Gated by the same window math the learner
  uses (`startsAt - 15min` … `startsAt + duration`), computed from data already on the card.
  Before the window the button is visible but disabled with the reason, so the teacher is not left
  guessing (matches the existing "Confirm & Pay" disabled pattern).
- `WEB_ROUTES` in `lib/api-map.test.ts` + `docs/api/FRONTEND-API-MAP.md` for both new routes
  (`FRONTEND-API-MAP.md:152` makes this mandatory).

Tests: `room-access-client.test.ts` for the new reason mapping; a component test that the Join
action is present only in the permitted window.

Commit: `feat(web): add teacher join entry point for live classes`

### Phase 5 — Web: the teacher's side of the room

`components/classroom/TeacherLiveClassroomContent.tsx` reusing the extracted pieces
(`loadJitsiExternalApi`, `buildJitsiOptions`, chat client) rather than forking them:

- Participant panel: the signed-in teacher renders as **You (Instructor)**; the enrolled learners
  come from the roster. No live presence is claimed — the panel shows enrolment, and presence stays
  in `class_presence`.
- **Removed for the teacher:** escrow amount, "Confirm & Release Escrow", "Finish Class & Proceed to
  Review". Those are the learner's money actions; showing them to the teacher invites a click that
  the API correctly refuses.
- Kept: timer, chat, mic/camera/screenshare, Leave Room, and an explicit "End class" affordance only
  if one already exists server-side — otherwise it stays out of scope here.
- `privacy`/locale strings added to both `vi` and `en` (never mixed on one screen, per DESIGN.md).
- Extract the shared iframe lifecycle into `components/classroom/use-jitsi-conference.ts` so the two
  pages cannot drift; the learner page keeps behaving exactly as today (its tests must not change).

Commit: `feat(web): add teacher live classroom view`

### Phase 6 — Docs and gates

- `FRONTEND-API-MAP.md`: both routes.
- `docs/api/classes.md` via `pnpm docs:api`.
- `docs/runbooks/demo-dataset.md`: the teacher join path.
- No diagram change: no container or component is added (ADR-040 records a decision only), so
  `docs/diagrams/c4/` is untouched. State this explicitly in the commit body.

Commit: `docs(live-class): document teacher room access`

---

## 3. Verification

`pnpm verify` green (lint, build, typecheck, jest in api/gateway/contracts, vitest in web,
`test:arch`).

Then **live**, which is the point of the phase:

1. Re-seed (`node scripts/seed-demo.mjs --allow-remote`) so the demo dataset is clean, then move a
   demo class into its window (a seed class is 24h+ out; the demo needs one starting within
   `openMinutes`). Record the exact class used.
2. Two separate browser contexts — **not two tabs** (they share `localStorage`, so the second login
   would overwrite the first):
   - Context A: `user1@demo.skillswap.local` (teacher) → studio → **Join room**.
   - Context B: the rostered learner of the same class → `/{locale}/bookings/<id>/live`.
3. Assert both reach `IN ROOM` / `Room connected`, and that `data.id` from the JaaS prejoin matches
   the two account ids.
4. Assert `class_presence` gained a row for the **teacher** account — this is what makes FR-020
   achievable, and it is the assertion that proves the fix is real rather than a rendered button.
5. Assert the teacher token is `moderator` and the learner token is not.
6. Negative controls: teacher on a `cancelled` class → `class_not_joinable`; teacher on another
   teacher's class → 403; outside the window → `window_not_open` / `window_closed`.

## 4. Risks

| Risk | Mitigation |
|---|---|
| A new `moderator` path could let a non-teacher end someone's class | Authorisation reads `classView.teacherId` from the row, never from the request body; negative-control test. |
| Two window implementations drift | Teacher path calls the existing `windowBounds`; a test asserts the teacher and learner entry points agree. |
| Duplicating the classroom forks the Jitsi lifecycle | Phase 5 extracts a shared hook; the learner page's existing tests must stay untouched and passing. |
| Roster read leaks learner identities | Teacher-only (404 otherwise), active bookings only, names through the `account-profile` facade — no cross-schema join. |
| JaaS free tier is 25 MAU | Unchanged by this plan; already a recorded limit. |

## 5. Out of scope

- Live participant presence in the UI (presence is webhook-fed and already stored; surfacing it is a
  separate read).
- Teacher-initiated "end class" / early completion.
- Mobile teacher room access (the mobile client has no teacher flow at all — see issue #106, which
  also records that mobile never passes the room JWT).
- The 9 pre-existing defects found during flow testing; those stay reported, not fixed, here.
