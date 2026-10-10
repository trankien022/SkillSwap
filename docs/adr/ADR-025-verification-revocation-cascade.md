# ADR-025: Verification revocation and rights cascade

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-10

**Context.** FR-019 makes student verification *enforceable*: when a verification is no longer
valid, every right it granted must be demoted. This is the `cascade / grandfather` half of OQ-008
(the storage/validity half was fixed for FR-002 in ADR-023). AC-021 requires both cascade and
grandfather directions to be testable.

**Decision (developer, 2026-10-10).**

1. **Trigger — admin revocation only.** A verification is demoted by an explicit Administrator
   **revocation** with a reason. There is **no time-based expiry** (FR-002/ADR-023 decided
   approvals do not expire). Admin revocation is the sole demotion trigger in the MVP.

2. **Cascade, no grandfather.** When a verification is revoked, the account's `VERIFIED` rights are
   demoted **immediately**; existing commitments are **not** grandfathered. This matches ADR-020's
   room-access decision ("no grandfather exception in MVP"): rights are re-checked per request
   against current status, so a revoked user loses access at once.

3. **Mechanism now, consumers as modules land.** The cascade is an **event**,
   `student.verification.revoked`, written to the transactional outbox in the same transaction as
   the state change (ADR-013). Downstream modules demote what they own **when those modules exist**;
   today there are no `VERIFIED`-gated rights yet (FR-003/004/005/014 are unbuilt), so:
   - the **only live consumer is FR-017's projection** (`account-profile`), which will show the
     `revoked` status;
   - FR-005 (publish gate), FR-003 (skills) and FR-014 (payout) **consume this event when built** —
     they must not join `student_verification` (ADR-014); they read their own projection (ADR-024).

4. **Re-verification.** After revocation (or rejection), a Learner may **submit again** — the same
   FR-002 submission path. Because the revoked row is no longer *effective* (SR-BR-011 counts only
   `pending`/`approved`), a new submission is allowed and starts a fresh `pending` verification.

5. **States and rights.** A verification status becomes one of `pending | approved | rejected |
   revoked`. `hasVerifiedRights(status)` is true **only** for `approved`; a `revoked` (or
   `rejected`, `pending`) verification grants nothing. The FR-017 projection exposes `revoked` with
   the revocation reason so the user sees "needs re-verification" guidance.

**Rationale.** Admin-only revocation matches the manual-verification product model and avoids
re-introducing expiry that FR-002 explicitly rejected. Cascade-now is consistent with the existing
room-access decision and is the simpler, more protective rule (a revoked fraudster's published
supply stops). Building the mechanism now — with events the later FRs consume — avoids inventing
rights that do not exist yet while keeping FR-019 the single reusable cascade contract.

**Consequences.**

- (+) One demotion trigger and one event; rights are always re-checked against current status.
- (+) FR-005/FR-003/FR-014 plug into the cascade without touching `student_verification`.
- (+) Re-verification reuses the FR-002 path; no new submission flow.
- (−) A revoked user loses in-flight access immediately (no grandfather) — intended.
- (−) Downstream demotion is partly latent until those modules land; only the status projection is
  exercised end-to-end today.

**Verification.** Domain: `revoke()` transitions `approved|pending → revoked`; `hasVerifiedRights`
is true only for `approved`. Application: revoke requires the admin role and a reason, and emits
`student.verification.revoked` once (idempotent). Projection: the owner's status shows `revoked` +
reason; architecture tests stay green.

**Related:** ADR-013 (outbox), ADR-014 (per-module schema), ADR-020 (no grandfather in room access),
ADR-023 (verification model), ADR-024 (trust projection).
