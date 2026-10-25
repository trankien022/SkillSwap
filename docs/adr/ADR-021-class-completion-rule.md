# ADR-021: Class completion and income release rule

- **Status:** Accepted — **amended 2026-10-25 (see §Amendment A)**: `teacher_ended` is removed
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
