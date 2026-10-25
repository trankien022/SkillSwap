---
title: W4 — Audit actor attribution (FR-015 §9)
type: plan
date: 2026-10-24
topic: w4-audit-actor-attribution
status: Unblocked — gates closed 2026-10-25 (actor on the command; ADR-035)
owner: Group 4
---

# W4 — Audit actor attribution

**Parent:** [`2026-10-24-fr-completion-master-plan.md`](2026-10-24-fr-completion-master-plan.md)
**FRs:** FR-015, NFR-005 · **ACs:** AC-032 · **Modules:** `admin-operation` (consumer), `student-verification`, `skill-verification`, `wallet-ledger`, `shared/http`
**Priority:** P1 — AC-032 is stated as met-with-a-caveat; the `actor` filter currently matches nothing.
**New ADR required:** **yes** — mandatory prerequisite, because it changes the event contract that ADR-013 defines as the modules' public vocabulary.

---

## 0. What is actually wrong

ADR-034 §9 is explicit and honest:

- every audited event is mapped with `actorId: null`;
- the actor filter on `GET /audit-log` therefore matches only rows written without an actor (i.e. all of them);
- no request context exists (`shared/http/identity.ts` reads `x-user-id` at the boundary, nothing threads it deeper).

The consequence is the one an audit log exists to prevent: **an administrator cannot answer "what did this person do"**, which is one of AC-032's three filters and one of FR-015's stated purposes ("audit log filterable by actor, time and action type").

ADR-034 §9 also says closing it "is therefore its own decision with its own ADR" and affects every emitting module. That is this work item.

---

## Phase 0 — Conflict resolution gate (**developer interference required**)

> **STOP.** This wave changes an event payload contract shared by three modules. The ADR must be merged before any code.

| # | Conflict | Rules in tension | Decision owner | Blocking? | How it is closed |
|---|---|---|---|---|---|
| C1 | **`actorId` in the payload vs. "a fact has no actor"** | ADR-034 §9 (refuses to put request identity in the event contract) vs. FR-015 (audit filterable by actor) vs. NFR-005 (privileged actions audited *with actor*) | Engineering + Product Owner | **CLOSED 2026-10-25 — actor on the command** | ADR-035 records it: an approval *is* an act by a person, so the fact carries its cause. Ambient `AsyncLocalStorage` stamping is explicitly rejected (see the option table below) |
| C2 | **What does `actorId` mean for system-originated events?** | OQ-003 (auto-cancel on no-show), OQ-006 (auto-complete at `starts_at + duration`), OQ-008/ADR-025 (revocation cascade) — none has a human actor | Product Owner + Engineering | **CLOSED 2026-10-25 — `SYSTEM_ACTOR_ID` constant** | So `NULL` exclusively means legacy/unknown and a reader can tell them apart |
| C3 | **Backfill legacy rows?** | NFR-005 (audit completeness) vs. BR-031 spirit (financial/audit history is not rewritten) and ADR-034 (append-only) | Product Owner | **CLOSED 2026-10-25 — no backfill** | A backfill would fabricate attribution |
| C4 | **Deploy order** | ADR-013 (consumer parses strict schemas) vs. a live system during rollout | Engineering | Closed — engineering call | Two-step deploy: emitters first, consumer strictness last. Written into ADR-035 |
| C5 | **Does this need a new OQ id?** | BRD currently defines OQ-001…OQ-013 and **OQ-013 is already taken** (verifier expertise, resolved by ADR-027) | BA | **CLOSED 2026-10-25 — ADR-only** | FR-015 already requires the audit actor, so nothing is "open"; **no OQ is minted**. Do **not** reuse OQ-013 |

**Already resolved — do not reopen:** ADR-027 (verifier expertise/claim — this is OQ-013's real content), ADR-028 (evidence audit shape), ADR-034's split between `auditEventSchema` and `evidenceAuditEventSchema`.

**Exit criteria:** C1/C2 decided, C5 resolved (ADR-only or OQ-014), ADR-035 merged.

**Commit:** `docs(adr): decide audit actor attribution`

---

## Phase 0b — Prove the gap (read-only)

Write one test that fails today: a verifier approves evidence, then `GET /audit-log?actorId=<verifier>` returns zero rows. Commit it as `describe.skip` with a reference to this plan, so the "before" state is on record without breaking `pnpm verify`.

**Commit:** `test(admin-operation): record the inert actor filter (skipped)`

---

## Phase 1 — Contract change (after C1, C2, C5)

`packages/contracts`: every audited event payload gains `actorId: z.string().uuid() | SYSTEM_ACTOR`.

- `student.verification.approved|rejected|revoked`
- `skill.evidence.claimed|approved|rejected`
- `skill.verifier.suspended|revoked`
- `wallet.topup.settled` (and future withdrawal events)
- `class.completed|cancelled` (system)

Add a contracts spec asserting each schema **rejects** a payload without `actorId` — that is the enforcement that stops a future producer forgetting it.

**Breaking-change policy:** additive on the envelope but *required* on the payload means an old producer in flight during deploy fails parsing → `PermanentHandlerError`. Deploy order matters: emitters first, consumer's schema strict last, or accept a small window with the consumer lenient during rollout (decide in ADR-035).

**Commit:** `feat(contracts): carry the acting account on audited events`

---

## Phase 2 — Thread the actor through use cases

For each audited use case:

1. add `actorId` to the command type (`port/in/*.ts`);
2. controller fills it from `currentUserId(request)` — already available;
3. use case passes it to the repository;
4. repository writes it into the outbox payload **and** into its own row where an `*_by` column exists.

Files touched (one commit per module):

- `student-verification/.../decide-*.use-case.ts`, controller, `sql-*repository.ts`, migration `reviewer_id`/`decided_by` where missing;
- `skill-verification/.../decide-evidence`, `claim-evidence`, `suspend-verifier` — `claimed_by` already exists;
- `wallet-ledger` top-up settlement (`accountId` of the payer is not the actor — for an IPN the actor is the **system**, the *beneficiary* is the payer; keep them distinct in the payload).

**Tests per module:** use case forwards the actor; repository writes it into the outbox payload; a command without an actor is a compile error (type-level, no runtime test needed).

**Commits:** `feat(student-verification): record the deciding admin on audited events` , `feat(skill-verification): record the deciding verifier on audited events` , `feat(wallet-ledger): attribute settlement events to the system actor`

---

## Phase 3 — Consumer reads it

`admin-operation` audit consumer: map `actorId` from the payload instead of `null`; drop the acknowledgement in ADR-034 §9.

**Tests:** consumer round-trip writes the actor; `GET /audit-log?actorId=…` returns exactly that actor's rows; a row with the system actor is distinguishable from a legacy `NULL`.

**Commit:** `feat(admin-operation): attribute audit rows to their actor`

---

## Phase 4 — Evidence and docs

- Reproduce AC-032 end to end: a verifier approves evidence, an admin queries by that verifier's id, exactly one row comes back (this is the test the current implementation cannot pass).
- ADR-034 §9 → marked **superseded by ADR-035** (append a note, do not rewrite the section).
- SRS AC-032 note ("lọc theo người thực hiện hiện chưa khớp bản ghi nào…") removed.
- `docs/api/admin-operation.md`: document the actor filter as functional.

**Commit:** `docs(adr): mark the audit actor limitation closed`

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| **`AsyncLocalStorage` "just for the outbox" is proposed in review** | **High** | ADR-035 already rejects it with the sweeper-inherits-a-request argument — cite it |
| **Someone reuses `OQ-013` for this decision** | Medium — the ids look free | C5: ADR-only, or mint OQ-014. OQ-013 belongs to verifier expertise (ADR-027) |
| Deploy-order break: emitters and consumer in different releases | Medium | Two-step deploy in ADR-035; consumer lenient for one release |
| Option A grows command signatures across many files | Certain | Do it module by module; `pnpm typecheck` is the gate |
| System-actor constant leaks into user-facing copy | Low | Constant is a UUID, never displayed |

## Human decisions — **all closed 2026-10-25**

| Decision | Owner | Outcome |
|---|---|---|
| C1 — where the actor travels | **Engineering + Product Owner** (ADR-035) | **On the command** → event payload |
| C2 — system actor representation | **Product Owner + Engineering** | Constant `SYSTEM_ACTOR_ID` |
| C3 — no backfill of legacy rows | Product Owner | **No backfill** |
| C5 — ADR-only or a new OQ | **BA** | **ADR-035 only** — OQ-013 is taken; no OQ minted |

## Definition of done

- ADR-035 merged (and C5 resolved) before any code.
- AC-032's actor filter demonstrably works end to end.
- No audited event can be emitted without an actor (contract-level).
- `pnpm verify` green.
