# ADR-037: Admin-initiated account lock, and the removal of `disputed`

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-25
- **Closes:** OQ-015 (account-lock scope), FR-015's account-lock clause, ADR-034 §8 (partially)
- **Related:** ADR-030 (roles), ADR-034 (admin audit log + dashboard), ADR-035 (`actorId` on audited events), ADR-014 (per-module schema)

**Context.** FR-015 promises an Administrator dashboard with four parts. Three shipped in ADR-034:
the student-verification queue, the Verifier queue by domain, and the audit log. The fourth —
"account-lock list" — did not, and ADR-034 §8 said why: the product had never defined what an
account lock *is*, and it refused to invent one. That refusal was right, and this ADR is the
specification it was waiting for.

The same section left a second gap: a **dispute list**. That one closes differently. Nothing in the
BRD or the SRS ever defined a dispute. OQ-003's *title* mentioned one, but its resolution (refunds
are app-wallet credits; teacher no-show; learner no-show; pending expiry) never did. Searching the
product requirements turns up no dispute workflow, no dispute state, and no administrator action
that only a dispute could trigger. The concept arrived as a word in a dashboard list and never
acquired a definition.

**What the W6 decision gate settled** (closed by the named owners on 2026-10-25):

| # | Question | Decision | Owner |
|---|---|---|---|
| C1 | Is an account-lock list compatible with C-010 ("MVP has no automated report/lock system")? | **Yes** — an **admin-initiated suspension list**. C-010 constrains automation, not admin action | Product Owner |
| C2 | What is a dispute? | **Nothing.** No dispute workflow in the MVP; the clause is amended away | Product Owner |
| C3 | Does `disputed` become a real booking state? | **No** — removed from the vocabulary | Engineering + Product Owner |
| C4 | Which OQ covers the lock? | **OQ-015.** OQ-013 is taken (ADR-027). **OQ-014 is deliberately never minted** | BA |
| C5 | Is S17 a web screen? | **API-only** for the lock list; a screen may be requested later. **Superseded by Amendment A (2026-10-26): S17 ships as a web screen** | Product Owner |
| C6 | Moderation boundary | Unchanged; disputes are gone, so this is now only about locks | Product Owner |

**Decision.**

1. **A lock is an extension of the status that already exists, not a new aggregate.** `accounts.status`
   already has `active | suspended`, and `assertAccountCanSignIn` already refuses a suspended
   account. The lock therefore adds three columns to describe *why* rather than a new state machine:
   `suspended_reason` (required when the status is `suspended`), `suspended_by`, `suspended_at`.
   A second "locked" concept alongside `suspended` would create two words for one condition, and the
   first bug would be a code path that honours one and forgets the other.

   `account-profile` owns these columns. The dashboard reads them through a port — **never** through
   cross-schema SQL (ADR-014).

2. **The reason is required, and every lock and unlock emits an audited event carrying the actor.**
   OQ-015 says "with a required reason, recorded with actor and timestamp". A suspension without a
   reason is indistinguishable from a bug, and the Administrator who applied it cannot be held to
   account for it. This is exactly the case ADR-035 exists for: the event is a statement about a
   privileged act by a person, so `actorId` goes on the payload, and the audit log answers "who
   suspended this account and why". The events join `AUDITED_EVENT_TYPES` under the same rule
   established in ADR-035 §1 — privileged state changes are audited; effects of time are not.

3. **Nothing is automatic.** C-010 forbids automated reporting and locking, so there is no trigger,
   no threshold, no scheduled sweep that suspends anyone. An Administrator suspends an account by
   calling the API with a reason. This is restated because "account-lock list" reads like an
   automation feature to anyone who has not read C-010, and re-litigating it later would be
   expensive.

4. **A lock stops new commitments, not existing ones.** With OQ-015 and BR-016 together: a suspended
   Teacher's already-confirmed bookings **stay joinable**, because the learner paid, planned, and is
   owed the class. Only *new* bookings are refused. Cancelling confirmed classes to punish a Teacher
   would transfer the penalty to a learner who did nothing wrong — the same reasoning ADR-025 uses
   for revocation, and the same reason W8 grandfathers confirmed bookings when a Teacher's
   verification is revoked.

5. **The dispute clause is removed rather than specified.** FR-015's dispute list is amended away.
   The three situations a dispute workflow would have covered are already handled: teacher
   cancellation (BR-045), teacher no-show (BR-047), and any residual money disagreement through the
   manual ledger adjustment (BR-048). Specifying a dispute aggregate would duplicate three existing
   remedies behind a fourth entry point and an invented state, which is the outcome ADR-034 §8 was
   protecting against.

6. **`disputed` is removed from the booking vocabulary, and it is a code change, not a docs change.**
   The plan expected this to be a documentation edit. Following the identifier through the code
   found it in nine places: the `BOOKING_STATES` tuple, the table's `CHECK` constraint, the partial
   unique index `uq_bookings_active_learner_class` (which includes `'disputed'` in its `WHERE`
   clause), the refund lookup, `get-class-detail`'s blocked-state check, two port types, and the
   specs that enumerate it. Removing the value from the tuple alone would leave the database
   accepting a state the domain cannot represent, and the index guarding against double booking
   still covering a state that can never occur.

   Because the `CHECK` constraint and the index are schema objects, this needs a **migration** in
   `live-class`, alongside the `account-profile` migration in decision 1. Removal is safe on a live
   database for the same reason the value is removable at all: **no transition ever produced
   `disputed`**, so no row can hold it. The migration asserts that (a `SELECT` that fails if any row
   matches) rather than assuming it.

**Consequences.**

- (+) FR-015 becomes fully implemented for the first time, with one small feature instead of two
  speculative ones.
- (+) The lock reuses an existing status value, so suspension already blocks sign-in and needs no new
  enforcement path.
- (+) Removing `disputed` shrinks the vocabulary. A state no transition can reach is a state every
  future reader must reason about and every guard must handle, for no benefit.
- (−) Removing `disputed` touches the schema, so it is not the one-line docs change the plan
  predicted. It is the correct scope: leaving the database able to hold a value the domain rejects
  would be a worse compromise than the extra migration.
- (−) ~~The lock list is API-only (C5)~~ — **withdrawn by Amendment A**: the Administrator now has a
  screen. The trade-off is recorded there, along with what the screen owes in exchange.
- (−) A suspension does not cancel or refund anything. An Administrator who suspends someone
  mid-term must still handle that person's confirmed classes; nothing automates it (decision 3).

**Verification.** Model: a suspended account cannot sign in, book, or publish (the existing status
check, extended by the reason round-tripping); unsuspending restores access; `suspended_reason`,
`suspended_by` and `suspended_at` survive a round-trip; the migration is reversible and refuses to
run if a `disputed` row exists. Audit: locking and unlocking each produce an audit row under the
Administrator's `actorId` — not the suspended account's — which is the same distinction AC-032 tests.
Dashboard: `suspendedAccounts.total` agrees with the list it points at (the ADR-034 §7 invariant),
pagination holds, and a non-admin gets 403 with no fake list (AC-033). Vocabulary: no code, schema or
document references `disputed` after the removal.

**Related:** ADR-034 §8 (partially closed by this ADR; the actor-attribution half was closed by
ADR-035), ADR-035 (the `actorId` rule these events follow), ADR-030 (role model — an Administrator is
a role, not a second account type), ADR-025 (the "don't punish the counterparty" reasoning that
decision 4 reuses), ADR-014 (per-module schema and migration conventions).

---

## Amendment A — C5 is withdrawn; S17 ships as a web screen (2026-10-26)

**Status:** Accepted. **Amends:** the C5 row above, and the trade-off that repeated it.

**Why this amendment exists.** The W6 implementation plan specified a web screen for S17 in its
Phase 4, while this ADR and the SRS said the lock list was API-only by decision C5. The two
contradicted each other, and the contradiction was caught only after the screen had been built and
verified. Writing down which one wins — and why — is the point; leaving the ADR as it stands would
leave the repository describing a system that no longer exists.

**What changed in the facts.** C5 was recorded when S17 had no browser route at all and the lock
list existed only as a planned endpoint. Once the endpoint was built, the Administrator's position
was this: the lock is the one privileged act on this screen that has a *consequence for a person*
(suspension refuses their next sign-in), the reason is mandatory and audited, and the SRS's own
AC-033 already requires that a permission failure render as a message rather than a fake list. An
API-only lock means the Administrator has to hold a bearer token and drive `curl` to discharge a duty
the same ADR makes auditable. That is not a security boundary — the API enforces `@Roles('admin')`
either way — it is only an ergonomic one, and it favoured the harder path.

**Decision (supersedes C5).** S17 is a **web screen** at `/{locale}/operations`, for `admin` only.

1. **The screen renders the aggregate plus the locked-accounts list**, and offers lock (reason
   required) and release (no reason — decision 2 rejects one on a release).
2. **The verification and Verifier queues are linked, not embedded.** They already ship as their own
   routes with their own filters and paging; a second copy inside S17 would eventually disagree with
   the first and an operator would have no way to tell which was lying.
3. **The unauthorized state is its own rendering, never a filtered list.** A non-admin sees a
   permission message; the spec asserts the *empty* state is absent when the API refuses, because
   "nobody is locked" and "you may not see this" are opposite facts an empty list renders identically
   (AC-033).
4. **C-010 is untouched.** Nothing is automated: no lock, no report, no sweep. The screen only makes
   an administrative act reachable; the act itself is still a person's decision, carrying that
   person's `actorId`.

**Trade-offs.** (+) The auditable duty decision 2 imposes becomes performable without a terminal.
(+) The list, the count and the audit log are one screen, so the ADR-034 §7 invariant (a number and
the list it points at cannot disagree) is visible to the person acting on it. (−) The surface is
larger: two more components, a route, and the vi/en copy that every screen costs. (−) S17 is now a
place where a plausible-looking but wrong action can be taken by one click, so the UI needs its own
guards — which is why the lock form refuses a blank reason **before** the request leaves the browser,
in addition to the schema check the API performs.

**Verification.** Verified against the real stack, not only in tests: a blank reason is refused with
no request sent; a lock on a seeded account is refused at sign-in with `403`; the release restores
sign-in (`200`); the audit row names the **Administrator** as `actor_id` and the learner as
`target_id`; the same acts appear in the audit log with a readable label; both locales render with no
horizontal scroll at 360 px, and a non-admin sees permission messages rather than an empty list.
