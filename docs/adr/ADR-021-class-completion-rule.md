# ADR-021: Class completion and income release rule

- **Status:** Accepted — **amended 2026-10-25 (§Amendment A)**: `teacher_ended` is removed; **amended 2026-11-10 (§Amendment B)**: the web `Start` control is removed; **amended 2026-11-10 (§Amendment C)**: no learner-driven release; **amended 2026-11-10 (§Amendment D)**: the idle clock starts at `starts_at`, `ROOM_DESTROYED` is recovery-only, and the grace is configuration
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-10

**Context.** FR-020 requires a Class to move Published/Full → In progress → Completed/Cancelled, to record completion time and an auditable basis, and to gate rating and income release on an authorized completion. The class state machine and columns for this were declared in earlier increments but never activated. OQ-006's income-release half is resolved (ADR-018: Teacher income is held in `pending_credits` and released **on completion**); what remains is *what establishes completion* — which the FR-020 issue forbids inventing.

Two facts constrain the rule: FR-007 already cancels and refunds a booking when the **Teacher** no-shows (did not join within 15 minutes), and income (the Teacher's 90%) is only earned if the Teacher actually held the class.

**Decision.**

1. **Completion is about the Teacher, not the Learners.** A class completed means the Teacher held the session. Learner no-shows are the Learner's loss and never change the outcome; the Teacher earns as long as they held the class.
2. **Auto-complete at scheduled end.** A sweep runs when `now >= starts_at + durationMinutes`:
   - If the class has **no** `teacher_no_show` cancellation among its bookings → the class becomes **Completed** with `completed_at = now` and `completion_basis = 'scheduled_end'`. The Teacher's still-pending income for the class's confirmed bookings is released (ADR-018).
   - If the class has **at least one** `teacher_no_show` cancellation → the class becomes **Cancelled** with `cancellation_reason = 'teacher_no_show'`; nothing is released (FR-007 already refunded those Learners).
3. **Explicit end while present.** A Teacher may also end a class early: `InProgress → Completed` with `completion_basis = 'teacher_ended'`. This is the same outcome — the Teacher was present.
4. **Start.** A class enters `InProgress` when its start time arrives (sweep) or when the Teacher explicitly starts it. Starting never releases anything.
5. **Idempotent and one-way.** Completion and cancellation are terminal; completing an already-completed class is a no-op. Completion for the same class cannot emit twice (guarded by state), so release is idempotent on top of FR-009's per-booking release key.
6. **Release is a downstream effect.** Completing emits `class.completed` (outbox, ADR-013) carrying the class id and its confirmed bookings; the `wallet-ledger` consumer releases each booking's pending income. `live-class` never computes money.

**Rating eligibility** is a read derived from `state = 'completed'`: a booking on a completed class is eligible for rating (the rating feature itself is FR-013, out of scope here).

**Rationale.** Anchoring completion to the Teacher matches the product intent (a Teacher is paid for holding the class) and composes cleanly with FR-007's no-show refund, which already removed the unearned money. Time-based auto-completion needs no attendance signal beyond the one FR-007 already records, so FR-020 can ship before any richer presence tracking. Keeping release in `wallet-ledger` preserves the money-ownership boundary.

**Consequences.**

- (+) AC-011 is satisfiable: a completed class carries an auditable time and basis, enables rating, and releases income; cancellation leaves auditable state.
- (+) No money is released for a Teacher no-show (the class is Cancelled, not Completed).
- (+) Reuses FR-007's no-show record; no new attendance subsystem.
- (−) A Teacher who joined but left early is still Completed at end unless they explicitly end early; richer presence is deferred.
- (−) The completion sweep is another interval job in the API process (guarded/unref'd like the hold sweeper).

**Verification.**
- Unit: `canTransition` allows Published|Full → InProgress → Completed and → Cancelled from Published|Full|InProgress; completion requires a basis; terminal states are no-ops.
- Use case: sweep completes a class with no no-show and emits `class.completed`; sweep cancels a class with a teacher no-show and releases nothing; double-complete is a no-op; explicit end records `teacher_ended`.
- Wallet: release consumer moves pending → available per booking, once per release key; no-op if nothing pending.
- Architecture tests stay green.

---

## Amendment A — self-service completion removed (2026-10-25)

**Supersedes:** Decision §3 ("Explicit end while present") and the `teacher_ended` mention in §Verification.

**Decision (Product Owner, W1 gate C3).** A Teacher may **not** end a class themselves. The completion trigger is *the room closing*, not a person's command:

1. **Scheduled end.** Unchanged — at `starts_at + duration`, the class completes with `completion_basis = 'scheduled_end'` (Decision §2 stands).
2. **Room closes early.** If nobody is in the class any more, the room closes and the class completes. This is a **new** path, gated on two still-open questions (W1 C3a/C3b): what exactly "nobody in class" means, and which presence signal establishes it. Until both are answered this path is **not implemented** and only the scheduled end completes a class.
3. `completion_basis = 'teacher_ended'` is **removed** from the domain's `COMPLETION_BASES`. Existing persisted rows stay as history; no new ones can be written, and the service route that produced them is removed.
4. Either path publishes the same `class.completed` event; consumers are unchanged (Decision §6 stands).

**Why.** Decision §3 let the Teacher complete at any instant — **including before `starts_at`** — which released the Teacher's pending income for a class that had not happened. The earlier "trusted basis" argument assumed a well-behaved caller; the money consequence made that unsafe. Removing the capability makes the illegal state unrepresentable in the type system instead of policed by a guard, and it no longer relies on an attendance signal that does not exist (see §Consequences below).

**Consequences.**

- (−) **Breaking API change:** the completion route is removed. Clients must drop the call; the class now ends on its own.
- (−) Decision §Consequences' "explicitly end early" escape hatch is gone, so a Teacher who genuinely finishes a 2-hour class in 40 minutes keeps the room open until the scheduled end — or until C3a/C3b land.
- (−) The absence of any presence signal is now a **first-class gap**, previously masked by the Teacher's manual end. It blocks the early path, and it is the same missing signal that makes FR-007's teacher no-show rely on the Learner's word (`classes.controller.ts:156` hardcodes `teacherJoinedAt: null`).
- (+) No code path can complete a class before `starts_at`.
- (+) Rating and income release can only follow a session that actually ran.

**Verification (amended).** Unit: `assertCompletionBasis('teacher_ended')` now **throws**; the completion route 404/405s. Sweeper: completes exactly at the scheduled end, not one second before; emits once when paths race.

---

## Amendment B — the web "Start" control is removed (2026-11-10)

**Supersedes:** Decision §4 on the **client**; the API route itself is unchanged.

**Context.** Decision §4 says a class enters `InProgress` "when its start time arrives (sweep) or when the Teacher explicitly starts it". No start-time sweep was ever built — only the completion sweeper exists — so `Start` became the *only* producer of `in_progress`, and the web studio exposed it as a button on every `published`/`full` class.

Auditing what that button actually did turned up three facts:

1. **It changed nothing a teacher needs.** Room access is authorised on the **time window**, not on class state, and `published|full|in_progress` are all joinable (ADR-040). Completion is driven by the scheduled end; `findInProgressBeforeEnd` selects `published`, `full` **and** `in_progress`, so the state is not an input to completion either.
2. **Its event has no consumer.** `class.started` is written to the outbox and published, but no module subscribes. `wallet-ledger` listens only to `class.completed`.
3. **It was harmful and irreversible.** `in_progress` is a one-way door (`published|full → in_progress`, and from `in_progress` only `completed`/`cancelled`). While a class sits there: the marketplace hides it (`state IN ('published','full')`), reminders stop (`REMINDABLE_STATES` excludes it), new bookings are refused, and strangers get 404 on its detail. It could be pressed on a class that starts next week, and nothing could undo it.

So the control was a state-machine transition exposed as a button: every click was a one-way commitment with no benefit and several real costs.

**Decision.** The **web** studio no longer offers `Start`, and the web client no longer calls the route. The teacher enters the room through **Join room**; the class ends at its scheduled end.

The API route is **kept**, because the mobile client still uses it (#106 tracks mobile's missing teacher room access). Removing the route while mobile depends on it would break the app for no gain; removing the button removes the hazard.

**Consequences.**

- (+) A teacher can no longer hide their own class from the marketplace or silence its reminder by pressing a button whose label promises something it does not do.
- (+) One control, one meaning: joining is opening the room, and the class ends on its own.
- (−) `in_progress` now has **no producer at all** from either client. It remains a legal state for existing rows and for anything that writes it directly. If a future feature needs "the session is running", it should be derived from the window and presence (ADR-021 Amendment A §2 C3a/C3b), not written by a client command.
- (−) Decision §4's claim that the Teacher "explicitly starts" a class is now false for web. The sweep half of §4 was never implemented and is not implied by this amendment.

**Verification (amended).**
- Web: the studio renders no `Start` button and issues no `POST /classes/:id/start` for any class state (`instructor/page.test.tsx`).
- Web API map: `/classes/:id/start` is no longer listed as a web-called route (`lib/api-map.test.ts`), so a reintroduced call site fails the "only calls documented routes" test rather than passing silently.
- Mobile: unchanged — `teaching-gateway.spec.ts` still asserts the `POST …/start` call.

---

## Amendment C — the learner does not release escrow (2026-11-10)

**Supersedes:** nothing in the Decision; it settles a question the Decision left implicit.

**Context.** The learner dashboard offered a `Confirm & Release Escrow` button on a
finished session. It did not work, and could not have worked. Reading the handler
turned up three independent faults:

1. It called `POST /classes/bookings/:id/confirm`, which is FR-009's **settlement**
   request for a booking that is still `pending` — not a release. The repository
   answers a non-pending booking with `{ confirmed: false }` instead of an error
   (`sql-booking-repository.ts`), so the call returned 200 and did nothing. That is
   why the button "did nothing" rather than failing visibly.
2. It submitted the rating only `if (review.body.trim().length > 0)`. A learner who
   picked stars and wrote nothing had their rating silently discarded.
3. It offered the form whenever the clock said the session had ended, while the
   rating endpoint requires the class to actually be `completed`. Between the
   scheduled end and the completion sweep, the form was shown and then refused.

**Decision.** Escrow release is **not** a learner action, in the UI or the API. It
stays where Decision §6 put it: `class.completed` → outbox → `wallet-ledger`.

The both-sides-of-a-role argument is the reason, and it is the same one that removed
`teacher_ended` in Amendment A: a release button lets **the payer move the payee's
money** on their own say-so. A learner who wants the teacher's income withheld has
exactly one lever, and it already exists — the 15-minute no-show report, which
refunds rather than releases. For everything else, time releases.

The dashboard control therefore becomes a **review**: it always posts the rating,
never calls `/confirm`, and is offered only when the server reports
`ratingEligible`. Copy that promised a release is removed, in both locales.

**Consequences.**

- (+) The payer cannot release the payee's funds; the completion sweep is the only
  release trigger, as ADR-018 and Decision §6 already required.
- (+) A star-only review is recorded, so ratings stop under-counting silent reviewers.
- (+) No request is made that the API answers with a silent no-op.
- (−) A learner cannot release *early*. They never could — only the copy claimed it.
- (−) `POST /classes/bookings/:id/confirm` is untouched and still meaningful for its
  real purpose (settling a pending booking from checkout).

**Verification.**

- Web: `submitReview` posts the rating and issues no `/confirm` call; a rating with an
  empty comment still sends `{ stars, comment: '' }` (`lib/dashboard/http-gateway.test.ts`).
  These tests fail against the pre-amendment code.
- Web: the view model carries `ratingEligible`/`hasRated` from the server, and the card
  renders the review control only when eligible (`Dashboard.card`).
- Unchanged: release remains covered by ADR-021's own verification and
  `wallet-ledger`'s release tests.

---

## Amendment D — the idle clock starts when the class does (2026-11-10)

**Supersedes:** Amendment A §2's implementation, not its intent. Amendment A said "if nobody
is in the class any more, the room closes and the class completes" and gated it on
`starts_at`; the gate turned out to be satisfiable by a departure that happened *before* the
class, which is the same defect Amendment A was written to remove.

**Context.** Verifying the JaaS presence contract against 8x8's documentation
(`developer.8x8.com/jaas/docs/webhooks-payload`, read 2026-11-10) turned up four defects in
the shipped idle rule. Two of them change behaviour on a money path.

### D.1 A pre-start departure completed the class at the first sweep after `starts_at`

`evaluateRoomIdle` compared `now` against `startsAt` but never asked when the participants
left. The room opens `JITSI_OPEN_MINUTES` (15) before the class, so:

1. Teacher opens the room at `starts_at − 15m` to test their camera.
2. Teacher leaves at `starts_at − 10m`.
3. At `starts_at`, the rule sees "started" and "everyone gone for 10 min > 5 min grace" and
   reports idle.

The class then completes with basis `room_idle`, publishing `class.completed` and releasing
the Teacher's pending income (ADR-018) for a session that never happened.

**Decision.** The idle clock starts at `starts_at`, not at the first departure. A session
that ended before the class started is treated as having ended **at** `starts_at`, so the
full grace must still elapse *after* the class begins. This keeps the existing
"never before `starts_at`" invariant in substance rather than only in the letter, and it
means an early camera test can no longer end a class.

### D.2 A departure was ignored once the booking was no longer `confirmed`

Presence resolved its party list from bookings in state `confirmed`. A Learner whose booking
is cancelled mid-class therefore stopped being a party, their `PARTICIPANT_LEFT` returned
`not_a_party`, and their session row kept `left_at IS NULL` — leaving the room permanently
"occupied" so `room_idle` could never fire.

**Decision.** A **join** remains a party check: a stranger must not create presence, because
that is how an outsider could hold a room open or be its last departure. A **leave** only
requires that the room is one we issued and that the account holds an open session. A
departure is evidence about the room, not a claim about entitlement, and refusing it records
a false fact. A leave with no open session stays a no-op.

### D.3 `ROOM_DESTROYED` is accepted for recovery, and never completes a class

8x8 documents `ROOM_DESTROYED` as fired "after all of the participants have left", and the
controller previously discarded it as an unknown event.

It is **not** used as a completion trigger. JaaS creates a room on first join and destroys it
when the room empties, so a brief disconnect produces `PARTICIPANT_LEFT` →
`ROOM_DESTROYED` → `ROOM_CREATED` on reconnect; completing on that signal would end a
60-minute class in its second minute and release escrow irreversibly (§5), with the Learner
still connected. The vendor documentation names the case — `disconnectReason: "unknown"`,
"a participant experienced a connection issue". The event also says nothing about emptiness
that the last `PARTICIPANT_LEFT` does not already say.

Its value is fault tolerance. Presence is *inferred* from N deliveries, so a single lost
`PARTICIPANT_LEFT` leaves a row open indefinitely and the class silently loses its early
path. `ROOM_DESTROYED` arrives regardless and closes every open session for the class, under
the same `starts_at` floor as D.1.

The asymmetry is the decision: closing a presence row is reversible (a reconnect opens a new
one), completing a class is not.

### D.4 The grace period is configuration, and `0` is a valid value

`ROOM_IDLE_GRACE_MINUTES` was a constant with no environment override, unlike
`JITSI_OPEN_MINUTES`. It is now read from the environment, defaulting to **5** (W1 C3a).

`0` is meaningful and must not be rejected: it completes the class on the first sweep after
the last departure. `ApiConfig`'s existing `readInt` throws on `<= 0`, so this uses a
separate `readNonNegativeInt`. A negative or non-numeric value still fails loudly at boot:
silently coercing a typo into a plausible number is how a money path gains a rule nobody
chose.

**Note for operators.** The completion sweeper ticks every 60 s, so any value below one
minute behaves the same as `0`. A non-zero grace shorter than a record/reconnect cycle is the
only reason to deviate from the default.

**Consequences.**

- (+) An early room visit can no longer complete a class or release income.
- (+) A class can still end early when its booking was cancelled mid-session.
- (+) A lost webhook no longer disables the early path permanently.
- (−) A class whose only participants left before `starts_at` still waits the full grace
  after the start before completing, rather than completing instantly.
- (−) One more environment variable to document.

**Verification (amended).** Unit: a session joining and leaving entirely before `starts_at`
is **not** idle at `starts_at`, and becomes idle only after the grace elapses post-start;
a cancelled-booking departure closes its row; `ROOM_DESTROYED` closes open rows without
completing; grace `0` completes on the first sweep and grace `5` does not. Controller:
`ROOM_DESTROYED` is signature-checked like any other delivery. Config: `0` accepted,
`-1` rejected at boot.


