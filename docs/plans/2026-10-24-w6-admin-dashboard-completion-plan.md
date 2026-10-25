---
title: W6 — Admin account locks (dispute half removed)
type: plan
date: 2026-10-24
topic: w6-admin-dashboard-completion
status: Reduced — no dispute half; account-lock list decided 2026-10-25
owner: Group 4
---

# W6 — Admin operations dashboard completion

**Parent:** [`2026-10-24-fr-completion-master-plan.md`](2026-10-24-fr-completion-master-plan.md)
**FRs:** FR-015 · **ACs:** AC-031 · **Modules:** `admin-operation`, `account-profile` (lock source)
**Priority:** P2 — dispute half **removed**; account-lock half **decided** (admin-initiated suspension list). Needs **OQ-015** + ADR-037.

> **ADR numbering:** this plan was written when W5's chat ADR was expected at 036. W5 shipped that
> number first (ADR-036, in-class chat), so the account-lock ADR is **ADR-037**. References below
> are corrected; the plan's decisions are unchanged.

> **Status: deferred, and stays deferred until the product defines the domain.**
> ADR-034 §8 refused to invent a dispute/account-lock model and recorded FR-015 as **partially implemented** "until a separate spec + ADR covers them". That refusal was correct. **2026-10-25 the Product Owner answered**: there is no dispute workflow (FR-015's dispute clause is removed), and the account-lock list is an **admin-initiated suspension**, reusing the status that already exists. This plan therefore builds one small feature instead of two speculative ones.
>
> **Correction to an earlier draft of this plan:** it referred to the new question as "OQ-013". **OQ-013 is already taken** (verifier expertise, resolved by ADR-027). After the 2026-10-25 decision the **dispute half is removed from the MVP entirely**, so only **OQ-015** (account-lock scope) is minted. **OQ-014 is deliberately left unused.**

---

## 0. What is built vs. what is missing

Shipped by ADR-034 (`admin-operation`):

| Capability | Status |
|---|---|
| Student-verification queue | ✅ `VerificationSummaryReader` |
| Verifier queue by domain | ✅ `EvidenceSummaryReader`, counts `pending` + `claimed` only |
| Audit log (append-only, time/action filters) | ✅ (actor filter: W4) |
| Non-admin → 403, no fake lists | ✅ AC-033 |
| ~~Dispute list~~ | **Removed from the MVP 2026-10-25** — no dispute exists in the product model |
| **Account-lock list** | ❌ not implemented; concept decided (`Suspended` + reason), needs OQ-015 + ADR-037 |

The SRS data dictionary has no `Dispute` row and no "locked" state on `Account` — only `Active → Suspended`. With the dispute half removed by decision, **exactly one domain concept remains to be scoped: the admin-initiated lock**, which is an extension of the status that already exists rather than a new aggregate.

---

## Phase 0 — Conflict resolution gate (**developer interference required**)

> **STOP (closed 2026-10-25).** The account-lock half is decided; the dispute half is **removed from the MVP** by decision. What remains is the OQ id for the lock (**OQ-015**) and the ADR.

| # | Conflict | Rules in tension | Decision owner | Blocking? | How it is closed |
|---|---|---|---|---|---|
| **C1** | **Is an "account-lock list" compatible with C-010?** | FR-015 requires an account-lock list; **C-010** says "MVP has no automated report/account-lock system" | **Product Owner** | **CLOSED 2026-10-25 — admin-initiated suspension list** | Reuse the existing `Suspended` status with a reason + audit row. Nothing automatic. C-010 constrains *automation*, not admin action |
| **C2** | **What is a dispute?** | Nothing in the BRD/SRS ever defined it; OQ-003's title mentions it but its resolution does not | **Product Owner** | **CLOSED 2026-10-25 — no dispute workflow in the MVP** | FR-015's dispute list is **amended away**. The three real cases (wrong content, a no-show that slipped through, a post-completion money disagreement) are handled by the existing manual **BR-048** ledger adjustment |
| C3 | **Does `disputed` become a real booking state?** | SRS Appendix B vs. `uq_bookings_active_learner_class` | Engineering + Product Owner | **CLOSED 2026-10-25 — NO** | Remove `disputed` from the state machine (`Completed --> Disputed`), the data dictionary row, and the index's covered states, in one docs commit |
| C4 | **A new OQ id is required** | BRD defines OQ-001…013; **OQ-013 is taken** (verifier expertise, ADR-027) | **BA** | **CLOSED 2026-10-25** | **OQ-015** covers the account-lock scope. **OQ-014 is deliberately not minted** — there is no dispute to ask about |
| C5 | **Is S17 a web screen at all?** | SRS Appendix D S17 vs. FR-015 saying "dashboard" | Product Owner | Decided by default | **API-only** for the lock list; the SRS states it. A screen can be requested later without re-opening the gate |
| C6 | **Moderation boundary** | §1.2 out of scope: "moderation/report tooling beyond ratings"; C-010 | Product Owner | Closed | ADR-037 restates the boundary; disputes are gone, so this is now only about locks |

**Already resolved — do not reopen:** OQ-013 (verifier expertise — a different question that happens to share the number), ADR-030 (roles), ADR-034 (audit + queues, which stay as built).

**Exit criteria (met 2026-10-25):** C1/C2/C4 answered; C3/C5/C6 recorded. The dispute half closes as an SRS amendment with **no code**; the lock half proceeds.

**Commit:** `docs(srs): drop the dispute clause and scope the account lock (W6 phase 0)`


---

## Phase 1 — ADR

`ADR-037-account-lock-and-dispute-removal.md`, recording the Phase 0 answers plus:

- **FR-015 amendment**: the dispute list is removed; the reason is that no dispute was ever defined and every refund case is already covered (BR-045 teacher cancel, BR-047 no-show, BR-048 manual adjustment).
- **`disputed` removal** from the state machine, the data dictionary and `uq_bookings_active_learner_class`.
- ownership: `account-profile` owns the lock, as an extended `Suspended` status with `reason`, `locked_by` and `locked_at`;
- projection: the dashboard reads through **ports**, never cross-schema SQL (ADR-014);
- audit: every lock/unlock emits an audited event carrying W4's `actorId`;
- a restatement of C-010/BR-054 so the boundary is not re-litigated later.

**Commit:** `docs(adr): decide the account-lock model and remove the dispute clause`

---

## Phase 2 — Model

Per ADR-037. Collapses to one concept:

- `account-profile`: `accounts.status` gains `suspended_reason`, `suspended_by`, `suspended_at` + migration. **`suspended` already exists** as a status value, so this is an extension, not a new state.
- `live-class`: **nothing.** `disputed` is removed from the vocabulary in the Phase 0 docs commit; no transition guards, no capacity effect, no index change beyond the removal.

**Tests:** a suspended account cannot book or teach (reuses BR-004's "access determined by current status"); the reason survives a round-trip; unsuspending restores access; the migration is reversible.

---

## Phase 3 — Dashboard read ports

`admin-operation`:

- `GET /operations/dashboard` → add `suspendedAccounts: { total: number }` to the existing aggregate (already live-read, uncached, per ADR-034 §7 — keep that property). **No `disputes` count.**
- `GET /operations/accounts?status=suspended&limit&cursor`, capped and paginated (NFR-014);
- non-admin 403 (AC-033).

**Tests:** counts agree with the list they point at (the ADR-034 §7 invariant), pagination, 403.

---

## Phase 4 — Web admin screen

There is currently **no web route** for S17 (`/audit` is API-only, SRS Appendix D). This phase creates the screen the SRS promises the Administrator:

- `/{locale}/operations` — the three shipped panels (verification queue, verifier queue by domain, audit log) + a **suspended-accounts** section;
- the lock/unlock action, with a required reason;
- `admin` only; 403 renders a permission message, never a fake list (AC-033);
- vi/en, 360 px, status as text + colour.

**Commit(s):** `feat(admin-operation): aggregate suspended-account counts` , `feat(web): admin operations dashboard`

---

## Phase 5 — Close the loop

- SRS FR-015 status: `Partially implemented` → `Implemented (dispute list removed by decision; account-lock list shipped)`.
- SRS state machine and data dictionary: `disputed` removed (Phase 0).
- ADR-034 §8: append "closed by ADR-037".
- SRS Appendix D S17: give it a web route.
- Re-render any diagram that lists administrator goals (`docs/diagrams/checkpoint/source/use-cases.puml`).

**Commit:** `docs(srs): close the FR-015 dashboard gap`

---

## Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| **A developer builds an account-lock list despite C-010** | Medium | C1 decided: an **admin-initiated** list is in scope; C-010 forbids automation, not admin action. ADR-037 restates it |
| **The new question is filed as "OQ-013"**, colliding with verifier expertise | **High** — the earlier draft of this plan did exactly that | C4: mint **OQ-015** only |
| A developer resurrects `disputed` because the SRS still mentions it | **High** until Phase 0 lands | The removal is the **first** docs commit, before any code |
| A lock silently strands a teacher's already-paid learners | **Medium** — same trap as W8 C2 | Reuse W8's grandfather rule: existing confirmed bookings stay joinable; only new bookings are blocked |
| Admin dashboard becomes a second, drifting source of truth | Low | Live reads, no cache (ADR-034 §7) |
| Scope creep into "moderation tooling" which §1.2 lists as out of scope | Medium | ADR-037 explicitly restates C-010; a lock is an exception action, not moderation |

## Human decisions — **all closed 2026-10-25**

| Decision | Owner | Outcome |
|---|---|---|
| C1 — account-lock list vs. C-010 | **Product Owner** | **Admin-initiated suspension list** |
| C2 — dispute definition (or exclusion) | **Product Owner + Admin** | **Excluded — no dispute workflow** |
| C4 — mint **OQ-015** (account lock) | **BA** | **OQ-015**; OQ-014 deliberately unused |
| C3 — is `disputed` a real state | Engineering + PO | **No — removed** |
| C5/C6 — S17 screen and moderation boundary | Product Owner | API-only lock list; boundary restated in ADR-037 |

## Definition of done

- **OQ-015** exists and ADR-037 is merged before any model.
- The dispute clause is **removed** from FR-015 and `disputed` is removed from the state machine and data dictionary, in the same docs commit.
- One working dashboard section (suspended accounts) with lock/unlock and a required reason.
- A locked teacher's already-confirmed learners are not stranded.
- Every list paginated and admin-only.
