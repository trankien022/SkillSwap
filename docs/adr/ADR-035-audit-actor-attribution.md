# ADR-035: Audit actor attribution

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-25
- **Closes:** ADR-034 §9 (actor attribution not wired)

**Context.** ADR-034 §9 shipped the audit log with `actorId: null` on every row and said so
plainly: the actor column, its index and the `actor` filter on `GET /audit-log` exist but are
inert. That leaves AC-032 — "filterable by actor" — unmet, and it leaves FR-015's stated purpose
unserved, because an administrator cannot answer "what did this person do".

§9 also said the gap was structural rather than a bug, and that closing it "is its own decision
with its own ADR". The argument it gave was: *a domain event describes a fact, a fact has no
actor, so putting an actor in every payload would put request-scoped identity into the contract
ADR-013 defines as the modules' public vocabulary.* That argument is sound about the general case
and wrong about these events. This ADR records why, and what changes.

**What the W4 decision gate settled** (all four closed by the named owners on 2026-10-25):

| # | Question | Decision | Owner |
|---|---|---|---|
| C1 | Where does the actor travel? | On the **command**, and from there into the event payload | Engineering + Product Owner |
| C2 | What is the actor for system-originated events? | The constant `SYSTEM_ACTOR_ID` | Product Owner + Engineering |
| C3 | Backfill legacy rows? | **No** | Product Owner |
| C4 | Deploy order | Emitters first, consumer strictness last | Engineering |
| C5 | New OQ, or ADR-only? | **ADR-only.** OQ-013 is taken (verifier expertise, ADR-027) | BA |

**Decision.**

1. **An audited event carries the acting account in its payload.** The events that change
   protected state are not statements about the world; they are statements about a privileged act
   by a person. `student.verification.approved` is not "this student is now approved" — that is a
   *consequence* — it is "this administrator approved this student". The actor is part of what
   happened, not context around it. Once that distinction is made, the §9 objection dissolves:
   the actor is not request-scoped identity smuggled into a fact, it is a field of the fact.

   The distinction also tells us which events do *not* change. `class.started`,
   `class.starting.soon` and the booking lifecycle are effects of time and of the participants'
   own actions, already recorded in their own rows. They gain nothing and are left alone. An
   audit row no one reads is worse than no audit row, because it dilutes the ones that matter.

2. **`actorId` is carried on the command, not gathered from ambient state.** Each audited use
   case takes `actorId` in its input port; the controller fills it from `currentUserId(request)`,
   which already exists (`shared/http/identity.ts`). The use case passes it to the repository,
   which writes it into the outbox payload.

   **`AsyncLocalStorage` is rejected**, and this is the part worth writing down because it is the
   obvious alternative and it is wrong here. Ambient request identity would work for HTTP-triggered
   actions, but the same emitters also run from sweepers (`ClassCompletionSweeper`,
   `PendingHoldSweeper`, `ClassReminderSweeper`) and from consumers. A sweeper that happened to
   run inside a request's async context — a test harness, a future "trigger now" endpoint, a
   warm-up path — would inherit that request's identity and attribute a system action to a person.
   That is a silent wrong answer in an audit log, which is the one place a silent wrong answer is
   worse than a missing one. An explicit parameter cannot be inherited by accident: if it is
   absent at a call site, the call does not compile.

   **Amendment A (found during implementation).** That last sentence is true of the *call sites*
   it reaches, and of every plain `z.object` schema, but it is not a whole-codebase guarantee, in
   two ways worth recording because both were observed rather than imagined:

   1. **A refined schema does not typecheck its input.** `walletTransactionCompletedEventSchema`
      ends in `.superRefine(...)`, which makes it a `ZodEffects`. Its `parse` argument is typed as
      `unknown`, so an emitter could omit `actorId` and still compile. It failed at **runtime**,
      not at build time. The runtime guarantee therefore holds everywhere the compile-time one
      would have; the compile-time one was overstated for refined schemas only.
   2. **A payload built as a bare object literal is not checked by anything.** The outbox insert
      takes the payload as a parameter; the four emitting repositories built theirs as inline
      literals without a schema type annotation, so `tsc` accepted them with no actor and the
      requirement did not bite until the consumer parsed the message. The event therefore reached
      the broker, dead-lettered downstream, and the emitter looked clean — which is exactly the
      failure mode C4's emitter-first ordering is meant to make impossible to ship unnoticed.

   The lesson is the deploy-order rule below, not a code change: **the emitter must validate
   before it publishes**, not rely on the consumer's strictness to discover a bad payload. Until
   every emitter calls `schema.parse` on what it writes, `actorId` is enforced at the consumer,
   which is the wrong end of the wire.

3. **`SYSTEM_ACTOR_ID` is a constant, not `NULL`.** Auto-cancel on teacher no-show (OQ-003),
   auto-complete at `starts_at + duration` (OQ-006), the revocation cascade (ADR-025) and IPN
   settlement all happen with no human actor. They are attributed to
   `SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000000'`.

   The constant exists so `NULL` keeps exactly one meaning: **written before this decision**, or
   unknown. With `NULL` doubling as "the system", a reader could not tell an honest gap from a
   deliberate attribution, and the no-backfill ruling (C3) would be invisible. The constant is a
   valid UUID in the v4 shape so it passes the same validation as a real account and needs no
   special case downstream — but it is never displayed as a user, and the audit read joins it to
   nothing.

   A *settlement event* is the case that proves the distinction matters: for a SePay IPN the payer
   is the **beneficiary** and the system is the **actor**. They are separate fields, and
   conflating them would record the person who received money as the person who authorised it.

4. **No backfill (C3).** Rows written before this decision keep `actorId: null`. A backfill would
   have to invent attribution from timestamps and session logs, and BR-031's spirit — financial
   and audit history is not rewritten — applies to an audit log most of all. The historical rows
   are honest about what they are.

5. **Deploy order: emitters first, consumer strictness last (C4).** Making `actorId` required is
   a breaking payload change. ADR-013's consumers parse strict schemas and a validation failure is
   terminal (`DEAD`), so a release in which the consumer is strict and an emitter is old would
   dead-letter real events. The rollout is therefore two steps: every emitter ships first; the
   consumer's strictness lands only once no old emitter can still be publishing.

   This is the E8 rule from the master plan — emitters first, consumer strictness second — applied
   to the one wave where it has a concrete cost if ignored.

**Consequences.**

- (+) AC-032's actor filter returns rows, so "what did this person do" has an answer.
- (+) The actor is in the outbox payload, so it survives a replay: replaying a `DEAD` event
  re-records the correct actor rather than whoever ran the replay.
- (+) A system action is distinguishable from a legacy row, which makes C3's ruling observable.
- (+) No ambient state, so no emitter can inherit an identity it did not receive.
- (−) Every audited command signature changes; `pnpm typecheck` catches the call sites that pass a
  *typed* command or payload, but not the two gaps in Amendment A. A missed emitter is caught by
  the consumer's strictness at runtime, not at build time.
- (−) The payload contract is breaking, so the two-step deploy is mandatory rather than advisory.
- (−) Rows before this ADR remain unattributed forever. The audit log has a visible seam at the
  deploy date, which is the correct outcome and will look like a defect to anyone who does not
  read this.

**Verification.** Contract: every audited event schema rejects a payload with no `actorId`, and
`SYSTEM_ACTOR_ID` validates as an actor. Emitter: each audited outbox write calls its schema's
`parse` inside the writing transaction, so a payload without an actor fails the request instead of
reaching the broker (proved by removing the actor: 5 of 7 adapter tests fail with a `ZodError` on
`actorId`). Use case: the actor on the command appears in the outbox payload. End to end: a
verifier approves evidence, then `GET /audit-log?actorId=<verifier id>` returns exactly that row —
the test the pre-ADR implementation could not pass; and an Administrator's decision appears under
the Administrator's id, not the student's. Consumer: a duplicate delivery appends one row carrying
the same actor; a row attributed to `SYSTEM_ACTOR_ID` is distinguishable from one written with
`NULL`.

**Amendment A consequence for fixtures.** Because the emitter now validates, any test that writes
an audited outbox row must use a real account id, and real ids are UUIDs (`accounts.id` is `uuid`).
Several end-to-end fixtures used readable placeholders (`vf-art`, `admin-fr3-1`); those were
replaced with UUID-shaped values rather than relaxing `actorIdSchema`, because widening the schema
to fit a fixture would have made the column accept values the database cannot hold.

**Related:** ADR-034 (admin audit log; §9 closed by this ADR), ADR-013 (outbox, idempotent
consumers, Amendment A), ADR-014 (per-module schema), ADR-025 (revocation cascade), ADR-033
(SePay settlement); FR-015, NFR-005, AC-032, OQ-003, OQ-006.
