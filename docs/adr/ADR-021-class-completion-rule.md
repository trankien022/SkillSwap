# ADR-021: Class completion and income release rule

- **Status:** Accepted — **amended 2026-10-25 (§Amendment A)**: `teacher_ended` is removed; **amended 2026-11-10 (§Amendment B)**: the web `Start` control is removed; **amended 2026-11-10 (§Amendment C)**: no learner-driven release
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

