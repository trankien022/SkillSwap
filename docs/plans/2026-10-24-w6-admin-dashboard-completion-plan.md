---
title: W6 — Admin account locks (dispute half removed)
type: plan
date: 2026-10-24
topic: w6-admin-dashboard-completion
status: In progress — Phases 0–3 landed 2026-10-26; Phase 4 (web screen) next
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
| C5 | **Is S17 a web screen at all?** | SRS Appendix D S17 vs. FR-015 saying "dashboard" | Product Owner | Decided by default | **API-only** for the lock list; the SRS states it. A screen can be requested later without re-opening the gate. **Reversed 2026-10-26 — see ADR-037 Amendment A** |
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

### As shipped

`/{locale}/operations` renders the **dashboard aggregate** (counts by metric, backlog
by domain, recent audited actions) plus the new suspended-accounts section. The
verification queue and the verifier queue are **linked**, not embedded: both already
ship as their own routes with their own filters and paging, and a second copy inside
`/operations` would eventually disagree with them. The dashboard's metric cards are
already links into both, so the operator's path is the same one click away.

- `SuspendedAccountsPanel` — list, reason, `suspendedAt`, `suspendedBy`, and a
  two-step **Reinstate**. A release asks for no reason, because ADR-037 rejects one;
- `SuspendAccountForm` — lock by account id, reason **required**, refused in the form
  and again by the shared schema before the request leaves the browser;
- `unauthorized` renders its own block and is asserted **against** the empty state
  (AC-033): "nobody is locked" and "you may not see this" must not look alike.

Two stale things fell out of this and were removed rather than left to rot:

1. `Admin.auditLog.actorGap` ("audit entries do not carry the administrator's id
   yet") — false since W4. The notice and its spec are gone; the spec now asserts the
   notice is **absent**, so the claim cannot creep back.
2. `account.status.changed` was missing from `AUDITED_ACTIONS`, so the new action
   would have rendered as a raw dotted identifier in the audit log and dashboard.

`apps/web/src/lib/api-map.test.ts` gained the three `/operations/accounts` routes, so
a rename cannot ship with the map still naming the old paths.

---

## Deviations recorded during Phases 2–3 (2026-10-26)

Written down because each one moved work the plan did not predict, and a silent change
here would leave the plan claiming something the code does not do.

1. **Removing `disputed` was not a docs change.** The plan said Phase 2's `live-class` work was
   "nothing". Following the identifier found it in nine places: the domain tuple, three port DTOs,
   the mobile contract, the mobile renderer, the web mapping, the table's `CHECK` and the partial
   unique index `uq_bookings_active_learner_class`. It needed a **migration**
   (`1791072000009-RemoveBookingDisputedState`), which asserts no row holds the value before
   rewriting the constraint. The workspace-wide build is what surfaced the client sites — an
   `apps/api`-only typecheck passed while `apps/mobile` and `apps/web` still referenced the state.

2. **A second `account-profile` migration was needed.**
   `1791072000009-AddAccountSuspension` required a reason but not a timestamp, so a suspended row
   could exist with no `suspended_at` — and the lock list orders and paginates by it.
   `1791072000010-RequireSuspendedAt` tightens the constraint and **refuses to run** if such a row
   already exists, rather than inventing a date.

3. **The dashboard answers on two paths.** The plan names `GET /operations/dashboard`; ADR-034 §7
   already shipped `GET /admin-operation/dashboard`. Moving the route would break callers, so the
   controller answers on both. Same handler, so the two cannot disagree.

4. **`?status=` is a one-value enum.** The plan wrote `?status=suspended`; a free string would let a
   caller send `status=active`, get an empty page, and read that emptiness as "no locked accounts".
   The contract rejects anything but `suspended`.

5. **The lock action needed HTTP routes the plan did not list.** Phase 3 described reads only, but a
   list with nothing behind it cannot produce a row. Two routes on
   `account-profile`'s own controller serve it: `POST /operations/accounts/:id/suspension` (reason
   required) and `POST /operations/accounts/:id/reinstatement` (no reason). Separate routes, not one
   route with a status field, because the reason is required in one case and forbidden in the other.

6. **`account.status.changed` was added to `AUDITED_EVENT_TYPES`.** ADR-037 decision 2 requires lock
   and unlock to be audited with their actor; that only happens if the audit consumer's closed table
   names the event.

7. **A defect the unit tests could not see, found by E2E.** `changeStatus` read its updated row as
   `rows[0]` from `(await manager.query('UPDATE … RETURNING …'))`. Inside a transaction the pg driver
   returns `[rows, affectedCount]` for a writing statement, so `rows[0]` was the *row array*, not a
   row: `row.id` was `undefined`, and the audited payload failed its own schema. Every suspension
   returned 500. The existing specs handed back a bare `[row]` and passed; the repository already had
   `returnedRows()` for exactly this shape, and every other `UPDATE … RETURNING` in the codebase uses
   it. Fixed by using `returnedRows()`, plus a spec case that feeds the real `[rows, count]` tuple —
   confirmed to fail against the buggy version and pass against the fix.


---

## Phase 5 — Close the loop

- SRS FR-015 status: `Partially implemented` → `Implemented (dispute list removed by decision; account-lock list shipped)`.
- SRS state machine and data dictionary: `disputed` removed (Phase 0).
- ADR-034 §8: append "closed by ADR-037".
- SRS Appendix D S17: give it a web route.
- Re-render any diagram that lists administrator goals (`docs/diagrams/checkpoint/source/use-cases.puml`).

**Commit:** `docs(srs): close the FR-015 dashboard gap`

### As shipped — and one decision that had to be reversed

The plan called for a web screen in Phase 4, but the SRS and ADR-037 both said the lock list was
**API-only by decision C5**. The screen was built and verified before the contradiction was noticed.
The Product Owner was asked which won and chose the screen, so **C5 is withdrawn in an ADR-037
Amendment A** rather than quietly violated. Everything below follows from that:

- ADR-037 gained **Amendment A**, which records why C5 held when it was written (S17 had no browser
  route at all), what changed (the lock carries a consequence for a person and decision 2 makes it
  auditable — so an API-only lock asked the Administrator to hold a bearer token to discharge an
  audited duty), and what the screen must therefore get right.
- ADR-034 §8 is marked **closed by ADR-037**.
- SRS FR-015 now reads **Implemented** with the screen, citing Amendment A; **S17** in Appendix D
  gained its routes and its web layout, and the "two screens have no browser route" sentence became
  "one (S15)".
- `use-cases.puml` gained two Administrator goals — *Review the operations dashboard and audit log*
  and *Lock or release an account, with a reason* — with a note that the lock is admin-initiated
  only (C-010). The note claiming the dashboard was unimplemented is gone, and the PNG and SVG were
  re-rendered.

---

## Status: **closed**

W6 is complete. The account lock ships as model, API, audit and screen; the dispute clause is
removed; the dashboard's count and its list come from one source; and C5's reversal is on the
record rather than in a commit message.

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
| C5/C6 — S17 screen and moderation boundary | Product Owner | API-only lock list (**C5 reversed 2026-10-26: ADR-037 Amendment A**); boundary restated in ADR-037 |

## Definition of done

- **OQ-015** exists and ADR-037 is merged before any model.
- The dispute clause is **removed** from FR-015 and `disputed` is removed from the state machine and data dictionary, in the same docs commit.
- One working dashboard section (suspended accounts) with lock/unlock and a required reason.
- A locked teacher's already-confirmed learners are not stranded.
- Every list paginated and admin-only.
