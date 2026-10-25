---
title: W1 — Booking, settlement and completion integrity
type: plan
date: 2026-10-24
topic: w1-booking-integrity
status: Proposed
owner: Group 4
---

# W1 — Booking, settlement and completion integrity

**Parent:** [`2026-10-24-fr-completion-master-plan.md`](2026-10-24-fr-completion-master-plan.md)
**FRs:** FR-007, FR-009, FR-020 · **ACs:** AC-003, AC-004, AC-005, AC-011, AC-026, AC-027 · **Modules:** `live-class`, `wallet-ledger`, `student-verification` (read only)
**Priority:** P0 — correctness defects on money and on an access gate.
**Status:** **all gates closed 2026-10-25** — C1/C2 (unverified cannot book), C3 (no teacher-initiated completion), C3a/C3b (all-participants-leave + 5-minute grace + Jitsi webhook). Every phase is unblocked.
**New ADR required:** no (all three fixes stay inside existing boundaries; ADR-018/019/021/032 already decide the intended behaviour — the code diverges from them).

---

## 0. What is actually wrong

These are not new features. Each one is the code disagreeing with an ADR or with the SRS's own "Honest gaps" list (`SRS.md` §2.3).

### D1 — A Learner books without being a verified student

`apps/api/src/modules/live-class/internal/application/book-class.use-case.ts` → `execute()` calls `assertBookable()` with class state, starts-at, duration, capacity and teacher id. It never asks whether the **learner** is verified.

The verified-student projection already exists: `TeacherTrustReader` (`port/out/teacher-trust.ts`) exposes `verified` per account, fed by `student.verification.*` events (`project-teacher-trust.use-case.ts`). `create-class.use-case.ts` uses it for the **publisher**. Nothing uses it for the **buyer**.

US-M4 ("never hold a seat I cannot pay for" — here, "never buy what I am not eligible for") is therefore partial, and the SRS says so at §2.3.

**This was a requirements conflict, and it is now decided.** BR-001 says a user "phải hoàn tất xác minh sinh viên trước khi sử dụng các chức năng yêu cầu trạng thái sinh viên đã xác minh" and BR-004 says "quyền truy cập phải được xác định theo trạng thái hiện tại". The SRS never applied them to booking: US-T1 allows a user to explore "before I am verified", and UC-003's precondition listed only "Logged in; class Published with a free seat and sufficient balance".

**Product Owner decision, 2026-10-25 (W1 gate C1/C2): an account without an effective approved student verification may not book.** BR-001 therefore covers booking as well as teaching, and the SRS has been amended to say so — §2.3 decision note, UC-003 precondition and alternate flow, FR-007's statement, and the new **AC-034**. The code is now *wrong*, not merely ambiguous, and D1 is a defect to fix.

### D2 — Settlement can post twice for one booking when the settle key differs

`apps/api/src/modules/live-class/internal/adapter/out/persistence/sql-booking-payment-repository.ts` emits `booking.payment` with `settled: false` to request settlement; `wallet-ledger` settles idempotently on a **settlement key**. Phase C3b (see the comment at `confirm-booking.use-case.ts`) introduces an authoritative settlement key.

Risk: the idempotency of the debit rests on that key alone. If a second `booking.payment` request for the same `bookingId` arrives with a **different** settlement key (retry after a producer change, replayed outbox row from a different producer version, or a manual replay with an operator-chosen key), the unique-per-booking guard — `uq_ledger_settlement_per_booking` (`1791072000002-AddSettlementIdempotency.ts`) — is what actually stops a double debit. The check to make in Phase 1 is whether that index is **the** guard on every path, or whether any path keys off the settlement key alone.

This is listed as a **latent** defect: it may already be impossible, in which case Phase 3 is a test-only phase. That is the point of writing it down — the invariant must be *proven*, not assumed. **No OQ conflict**: BR-033 and BR-026 both require it.

### D3 — A class can be completed before it runs, and completion ignores hold expiry

Two separate problems in the same area:

1. `complete-class.use-case.ts` checks only "this class exists" and "you are the teacher". `ClassRepository.completeAndEmit()` accepts a class in `published | full | in_progress`. A Teacher can press "end class" on a class that starts in a week; it moves to `completed`, and `sql-class-repository.ts` emits `class.completed` with the confirmed bookings, which triggers teacher income release (ADR-018/021). **Money is released for a class that never happened.**
2. The sweep path (`ClassCompletionSweeper` → `completeElapsedClasses`) shares `completeAndEmit`, so it inherits the same lack of a "the scheduled end has actually passed" assertion inside the repository — the guard lives in the sweeper's query, not in the transaction. AC-011 requires completion "với thời gian/căn cứ audit" and release gated on eligibility.

The SRS §2.3 recorded this as "class completion commits before wallet settlement and does not check booking expiry". The commit-before-settlement ordering is **by design** (ADR-032 event-driven settlement) and stays; the *eligibility* check is the real defect.

**Decision 2026-10-25 (C3): the defect is fixed by removing the capability, not by guarding it.** A Teacher may not end a class at all. Completion happens when the room closes — at the scheduled end, or when nobody is in the class any more — and that is what publishes the event. `teacher_ended` therefore disappears from `COMPLETION_BASES` (`domain/class.ts:217`), which makes "completed before it started" unrepresentable rather than merely forbidden. See Phase 1 and Phase 1b.

### D4 — An expired Pending booking is still treated as a live hold between sweeps

`isPendingExpired()` exists in `domain/booking.ts` but is used only by the sweeper and by the concurrency fake. `assertBookable()` counts `existingBookings` without filtering expired Pending rows, so within the up-to-60-second gap before `PendingHoldSweeper` runs, a learner can be refused a seat that is already dead. Low severity, but AC-026 says the seat is released at ~15 minutes, not "at the next sweep".

`confirm-booking` on an expired Pending booking must also be rejected (money must not move for a dead hold).

---

## 1. Approach

One rule runs through all four items: **the domain decides, the repository enforces, the sweeper only tidies.** Today the eligibility rules are split across a use case (`assertBookable`), a SQL `WHERE` clause, and a timer, and the three disagree at the edges.

---

## Phase 0 — Conflict resolution gate (**developer interference required**)

> **STOP.** No code in this wave may be written until every row below is closed by a named human decision recorded in the SRS/ADR, not in a commit message or a chat. The investigator agent may *prepare* the answers but may not *decide* them.

| # | Conflict | Rules in tension | Decision owner | Blocking? | How it is closed |
|---|---|---|---|---|---|
| C1 | **May an unverified account book?** | BR-001 ("must complete student verification before using marketplace functions requiring verified status") vs. SRS US-T1 ("explore classes before I am verified") vs. UC-003 precondition (no verified clause) vs. BR-004 ("access determined by current status") | Product Owner | **CLOSED 2026-10-25 — answer: NO, an unverified account may not book** | Recorded in SRS §2.3 (decision note), §3.2.5 UC-003 (precondition + alternate flow), FR-007 text, and **AC-034**. Phase 3 implements it |
| C2 | **Does BR-001 cover booking, or only teaching?** | BR-001 (stated, unscoped; previously only ever used for teaching — BRD line 64, BP-002) vs. **BR-021**, which is a *deadline* rule only and does not enumerate booking conditions | Product Owner + BA | **CLOSED 2026-10-25 — BR-001 covers booking too** | BR-001 is no longer scoped to teaching. AC-034 is the new, stable criterion; BR-021 stays a deadline rule and is not overloaded |
| C3 | **May a Teacher end a class themselves?** | BR-043 + OQ-006 ("Completed when the approved rule is met, with time and audited basis") vs. the existing `teacher_ended` basis in ADR-021, which let the owner end the class at any moment — including before it started | Product Owner (ADR-021 amendment) | **CLOSED 2026-10-25 — answer: NO self-service end.** Completion is driven by the room: the Jitsi session is open from start time to end time and closes only when the scheduled end is reached or nobody is in the class any more. At that point the event is published and the class is Completed | See C3a/C3b/C3c below — this decision **does not** close Phase 1 on its own; it changes what Phase 1 builds |
| C3a | **Does "nobody in class any more" mean the room ended, or a learner left?** | "nobody in class" (decision, 2026-10-25) vs. a class that **has not started** (nobody is in it yet, by definition) vs. a 1-1 class where the learner has not joined yet | **Product Owner** | **CLOSED 2026-10-25** — (a) only from `starts_at`; (b) **all participants** must be gone (a Teacher leaving while learners remain does not end the class); (c) **5-minute** empty grace period | Recorded as AC-035's idle rule |
| C3b | **Where does presence come from?** | The decision needs "who is in the room" vs. **no presence source exists**: `classes.controller.ts:156` hardcodes `teacherJoinedAt: null` | Engineering + Product Owner | **CLOSED 2026-10-25 — Jitsi webhook** (`participant-joined` / `participant-left`) → new inbound endpoint | Also closes AC-024's teacher-no-show trust gap; must verify the webhook's shared secret, not its source IP |
| C3c | **Does the scheduled end still complete the class?** | The decision ("closes … when the class end") vs. the existing `scheduled_end` auto-completion, which already runs at `starts_at + duration` whatever happens | Engineering | No — already agreed by both readings | Keep it. The scheduled end remains the **backstop**; the idle rule is the early path. Both publish the same event |
| C4 | **Is a timeout on booking settlement a failure?** | BR-026 (booking+payment atomic) vs. BR-033 (no double charge on timeout) vs. BR-038 (income in `pending`, withdrawn only after release) | Engineering + Finance | No — existing OQ-006 answer governs | Confirmed: timeout is not failure; hold retained. Recorded as a **non-conflict** so a developer does not "fix" it by rolling back |
| C5 | **Does an expired hold free the seat before the sweep?** | OQ-007 resolved ("seats release only on booking Cancelled") vs. AC-026 ("auto-cancel after ~15 min") | Engineering (interpretive, not product) | No — but must be documented | Escalate to the Product Owner only if the interpretation is disputed. Default: expired *is* the cancellation; the sweeper merely persists it. Written into ADR-019 as a clarification |

**Already resolved — do not reopen:** OQ-003 (no learner cancellation), OQ-006 (release on completion, no-show cancels), OQ-007 (capacity/seat hold), OQ-012 (integer floor). If a developer believes one of these must change, that is a new OQ, not a code decision.

**Exit criteria:** C1/C2 closed (done 2026-10-25). C3 has a written answer and an owner signature. C4–C5 recorded as closed with their source. This gate's result is the first commit.

**Commit:** `docs(srs): require student verification to book (W1 phase 0)` — C1/C2 only; a second gate commit records C3 when it is decided.

---

## Phase 0b — Reproduce (no product change)

**Goal:** show each defect exists, or prove it cannot.

1. `book-class.use-case.spec.ts`: add a case where the trust projection returns `{ verified: false }` for the **learner** account and the booking succeeds. That is D1, red. (C1/C2 are now closed, so this test is **not** skipped — it is a genuine red test for AC-034.)
2. `wallet-ledger` integration spec (real Postgres, following the existing `sql-*` test style): post the same `booking.payment` request twice with **two different** settlement keys for one booking; assert exactly one debit and one `uq_ledger_settlement_per_booking` row. If it already passes, mark D2 **closed — proven** and delete Phase 2.
3. `complete-class.use-case.spec.ts`: complete a class whose `startsAt` is in the future; assert current behaviour (completes) **and that income is released**. That is D3a, red — and after Phase 1 this test must be replaced by an assertion that the capability no longer exists.
4. `booking.spec.ts`: `assertBookable` with an expired Pending row in `existingBookings`; assert the seat is (wrongly) counted as taken. That is D4, red.

**Exit criteria:** four failing (or three failing + one proof) tests committed as `test(live-class): reproduce ...`. No production code touched.

> **Gate:** C1/C2 closed 2026-10-25, so item 1 is a real test. C3 closed 2026-10-25, so item 3 is a real test. Items 2 and 4 have no OQ conflict. This phase has **no remaining blocker**.

**Commit:** `test(live-class): reproduce booking, completion and hold-expiry gaps`

---

## Phase 1 — Remove self-service completion (D3, **C3 closed 2026-10-25: no teacher end**)

The defect "a Teacher can end a class that has not run yet and release income" is **fixed by removing the capability**, not by guarding it. This phase can proceed now; the early-completion half (Phase 1b) is still gated on C3a/C3b.

1. **Remove `teacher_ended` from the domain:** drop it from `COMPLETION_BASES` (`domain/class.ts:217`) so the type system, not a SQL guard, makes the illegal state unrepresentable. Any persisted `teacher_ended` row is read as legacy (see step 4).
2. **Remove the endpoint and the use case:** `POST …/complete` and `CompleteClassUseCase` (`complete-class.use-case.ts:10`) — a Teacher no longer sends a completion command at all. Remove `CompleteClassPort`/its DTOs, then the controller route and its OpenAPI entry.
3. **Keep `scheduled_end` as the only basis:** the existing sweeper already completes at `starts_at + duration` and needs no new guard. Verify `complete-elapsed-classes` filters `starts_at + interval <= now` **in SQL**, not in JS.
4. **Data:** existing `teacher_ended` rows remain valid history (they are past, settled completions — never rewrite them); only the *ability to create new ones* is removed.
5. Keep commit-before-settlement (ADR-032) — do **not** fold settlement into this transaction.
6. **Docs/ADR:** amend ADR-021 §completion to record the removal and why (BR-016 locks the class; a Teacher who can end early can release income at will). Update `docs/api/` for the removed route; clients that call it are updated in the same release.

**Tests:** domain (`assertCompletionBasis('teacher_ended')` now **throws** — inverting the existing assertion at `class.spec.ts:166`); the route returns 404/405 (not 403 — it must not exist); sweeper spec (class exactly at the scheduled end completes, one second before does not); a regression test that no service method can produce a completed class before `starts_at`.

**Commit:** `feat(live-class)!: remove teacher-initiated class completion`

> **Breaking API change.** The removed route must be listed in the release notes and in the mobile/web client changelogs. Per AGENTS.md the commit type stays `feat` with `!`, and the body explains why.

---

## Phase 1b — Complete early when the room empties (C3a/C3b **closed 2026-10-25**)

**Rule (decided):** once `starts_at` has passed, if **all** participants have left the Jitsi room for **5 continuous minutes**, the room closes, the class completes with basis `room_idle`, and `class.completed` is published. Before `starts_at` the rule is **inert** — an unstarted class has nobody in it and must never complete itself.

1. **Inbound presence endpoint.** Receive Jitsi `participant-joined` / `participant-left` webhooks. Verify the shared secret (**not** source IP — Jitsi can sit behind any proxy); reject unknown rooms; never log room tokens. Map the Jitsi participant identity back to `accountId` (the token's `sub`), so an unauthenticated stranger who guesses a room name cannot affect state.
2. **Store presence** in a `class_presence` table (`class_id`, `account_id`, `joined_at`, `left_at`) in the `live_class` schema. One row per participant session.
3. **Add the domain rule** (pure, no framework): `isRoomIdle({ startsAt, now, lastParticipantLeftAt, graceMinutes })` → true only when `now >= starts_at` **and** every participant has `left_at` set and the newest `left_at` is at least `graceMinutes` ago.
4. **Add basis `room_idle`** to `COMPLETION_BASES` alongside `scheduled_end`, so the audit trail distinguishes "ended on time" from "everyone left".
5. **Extend `ClassCompletionSweeper`** (60 s interval) to evaluate `in_progress` classes for idleness and publish the **same** `class.completed` event as the scheduled path — one event shape, one consumer (ADR-013).
6. **Also fix AC-024:** `no-show` stops accepting `teacherJoinedAt: null` from the caller and reads "did the Teacher ever join?" from `class_presence`. That removes the current position where a learner's word alone triggers a refund.
7. **Degradation:** if the webhook feed is down, fall back to `scheduled_end` only. Never complete early on missing data.

**Tests:** `isRoomIdle` truth table (before `starts_at` = **always false**, including with zero participants; participants present = false; all left beyond grace = true; all left within grace = false; Teacher leaves but a learner stays = **false**); webhook signature rejection; a stranger guessing a room name changes nothing; sweeper emits exactly one event when the idle and scheduled paths race; a down presence feed never completes early; no-show requires real absence of the Teacher in `class_presence`.

**Commit:** `feat(live-class): complete a class when the room stays empty past the grace period`

---

## Phase 2 — Make settlement idempotency structural (D2)

Only if Phase 0b could not prove D2 closed.

1. In `wallet-ledger` settlement, take the booking row lock **first** (`SELECT ... FOR UPDATE` on the settlement record by `booking_id`), then validate the key, then post. Key becomes a secondary check, not the primary guard.
2. Keep `uq_ledger_settlement_per_booking` as the backstop; add a spec that proves the index is still reached when two transactions race.
3. Document the invariant in `docs/adr/ADR-018` §"Idempotency" as an amendment (not a rewrite).

**Tests:** `settlement-key-mismatch.spec.ts` (two keys, one booking → one posting, second request acknowledged as replay), concurrency spec with two connections.

**Commit:** `fix(wallet-ledger): lock the booking before settlement key validation`

---

## Phase 3 — Gate booking on effective verification (D1, **C1/C2 closed 2026-10-25: booking is refused**)

**Rule (decided):** an account without an effective approved student verification **cannot book at all** — no booking row, no Pending hold, no credit movement. The gate belongs in `assertBookable` (the same place capacity/lead-time/duration live), so **every** path that creates a booking inherits it, not just the confirm path. Browse/search stay open (US-T1); the learner is told to verify and then book.

**Files:**
- `live-class/internal/domain/booking.ts` — add `assertLearnerEligible({ learnerVerified })` + `assertBookable` calls it; add `BookingRejectionReason` member `learner_not_verified`.
- `live-class/internal/application/book-class.use-case.ts` — resolve the caller's verification via the trust projection and pass it in.
- `live-class/internal/application/port/out/teacher-trust.ts` — rename `TEACHER_TRUST_READER` → `ACCOUNT_TRUST_READER` (the port now answers about *any* account); keep the projection shape.
- `live-class/internal/adapter/in/web/classes.controller.ts` — map the reason to 409 with a stable code.
- `packages/contracts/src/index.ts` — extend the booking rejection union.
- Clients: `apps/web/src/lib/booking/*`, `apps/mobile/src/infrastructure/http/*` + message catalogues — rejection copy in **both** languages, with a path to the verification screen.

**Deploy hazard (verified against the seeds):** `scripts/seed-demo.mjs` creates 10 demo users, of whom **three are not approved** — indices 7, 8 and 10 carry `pending`, `pending` and `rejected` (`USER_STATUS` at line 425). Those three will stop being able to book, which is the *intended* outcome and should be confirmed as a deliberate demo state rather than a regression. The checkpoint fixture (`scripts/seed-checkpoint.mjs`) already marks its `learner`, `teacher` and `poor` accounts `approved`, so the `tasks/checkpoint-demo.md` walkthrough is unaffected. Record the seed expectation in the same commit either way.

**Tests:** domain (`verified` true/false, and the `rejected`/`revoked`/`pending` variants all refused), use case (no booking row and no ledger entry created for an unverified learner — assert the ledger, not just the error), controller (409 + code), contract round-trip, web + mobile message parity, and AC-034 end to end.

**Commit(s):** `feat(live-class): refuse bookings from learners without verified student status` , then the web and mobile copy commits.

---

## Phase 4 — Ignore expired holds everywhere (D4)

1. `booking.ts`: export `isLiveHold(booking, now)`; use it inside `assertBookable`'s seat count.
2. `confirm-booking.use-case.ts`: reject `hold_expired` before emitting the settlement request.
3. `bookings/me` read (`my-bookings.controller.ts` path) already reconciles status — confirm it reports `cancelled` rather than `pending` past expiry without waiting for the sweeper.

**Tests:** domain, use case (confirm after expiry → rejected, no settlement event emitted), read projection.

**Commit:** `fix(live-class): treat expired holds as released before the sweep`

---

## Phase 5 — Close the loop in the docs

- SRS §2.3 "Honest gaps": remove the booking-eligibility and completion bullets once true; update AC-011 note.
- SRS Appendix C.4 traceability: add the new rows (`learner verified`, `completion not before start`, `expired hold`).
- `docs/diagrams/checkpoint/source/state-booking.puml` and `state-class.puml`: reflect any new transition guard, then re-render with the plantuml skill's `render.py`.
- `tasks/todo.md` T09 prerequisite note: mark the settlement-order concern resolved.

**Commit:** `docs(srs): close W1 gaps and re-render lifecycle diagrams`

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| **A developer implements the learner gate without C1 answered** and the Product Owner later says it was never required | **High** — this is the exact failure mode this rewrite removes | Phase 0 gate is mandatory; the D1 reproduction test stays `describe.skip` until C1 is signed |
| Gating confirm on verification breaks the demo accounts used in `tasks/checkpoint-demo.md` | High | Seed the demo teacher/learner as approved before landing; add the seed note inside C1's answer |
| Renaming `TeacherTrustReader` ripples through many imports | Medium | Do it in one commit with `pnpm typecheck` as the gate; keep the old symbol as a deprecated alias if a client package imports it |
| D2 turns out to be unfixable without a schema change | Low | The unique index already exists; only ordering changes |
| D3's time guard gets bypassed by a future admin override endpoint | Low | The guard lives in SQL, so any path reusing `completeAndEmit` inherits it |
| C3 is answered as "teacher may end any time", making D3a a non-defect | Medium | Then Phase 1 shrinks to the sweeper guard only; do not delete the test |

## Human decisions required (summary)

| Decision | Owner | Blocks |
|---|---|---|
| C1/C2 — may an unverified account book? Scope BR-001 | **Product Owner + BA** | **CLOSED 2026-10-25 — NO** → Phase 3 |
| C3 — may a Teacher end a class themselves? | **Product Owner** (ADR-021 amendment) | **CLOSED 2026-10-25 — NO** → Phase 1 |
| C3a — what exactly does "nobody in class any more" mean? | **Product Owner** | **CLOSED 2026-10-25** — all participants, 5-min grace, only after `starts_at` → Phase 1b |
| C3b — which presence signal feeds the idle rule? | Engineering + Product Owner | **CLOSED 2026-10-25** — Jitsi webhook → Phase 1b |
| C4/C5 — timeout and expired-hold interpretation | Engineering, recorded | nothing (documentation) |

## Definition of done

- Every C-row above is closed in the SRS/ADR **before** the phase it blocks begins. **All are closed as of 2026-10-25.**
- All four defects reproduced then fixed, each with a test that fails on the parent commit.
- AC-034 is proven by a test that asserts **no booking row and no ledger entry** exist for an unverified learner.
- **No code path can complete a class before `starts_at`** — proven by a type-level removal of `teacher_ended`, not just a test.
- `pnpm verify` green; `pnpm test:arch` green.
- SRS gap bullets removed only when the tests prove them gone — the US-M4 learner-gate bullet is removed by Phase 3, not before.
- ADR-021 amended for the removal; `docs/api/` regenerated for the removed route.
- Diagrams re-rendered (AGENTS.md rule).
