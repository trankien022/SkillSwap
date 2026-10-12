# ADR-027: Verifier expertise, evidence queue and claim-lock

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-11

**Context.** FR-004 makes skill verification *authoritative*: only a Verifier decides skill
evidence, and only within their competence (SR-BR-002, BR-011/013/065, AC-018). The pre-FR-004
docs assumed an **Administrator invites Verifiers and assigns their review domains**, and that a
Verifier sees a **queue filtered by Administrator-recognised expertise**. The Product Owner has
now fixed the operational model: Verifier accounts are **provisioned outside the app** (seeded),
so the app has **no admin create/assign-domain flow**, yet **expertise is still required** to
review. Two operational facts also needed deciding: what a Verifier can *see*, and how
concurrent Verifiers avoid double-reviewing the same submission.

The taxonomy and level model are already fixed (OQ-001, ADR-026): a managed `category → skill`
catalogue and the ordered scale `beginner < intermediate < advanced < expert`. FR-003 supplies the
evidence source of truth (versioned submissions, `skill.evidence.submitted`).

**Decision (developer / Product Owner, 2026-10-11).**

1. **Expertise is seeded, not admin-assigned (model B).** Each Verifier carries an **expertise set
   of skills** drawn from the ADR-026 catalogue, and **may hold several skills**. Expertise is set
   **operationally (seed/onboarding)**; the application exposes **no endpoint for an Administrator
   to create a Verifier or assign expertise**, and no Verifier self-service. A Verifier is an
   account that already exists with a `verifier` role and its seeded expertise.

2. **Domain match = skill membership.** A Verifier's authority over an evidence request is exactly
   `evidence.skillId ∈ verifier.expertise`. This satisfies BR-011 ("chuyên môn phù hợp"), BR-013
   ("chuyên môn đang hiệu lực") and BR-065 / AC-018 ("domain-matched") — the *matching* requirement
   is unchanged; only *who sets* the expertise changed (seed, not admin).

3. **The queue is expertise-scoped.** A Verifier sees only **pending** evidence requests whose
   skill is in their expertise set. The Verifier chooses a skill to verify **from that queue**
   (matches the PRD's "queue filtered by expertise"), not from the whole catalogue.

4. **Claim locks the evidence (new rule).** A Verifier **claims** a specific evidence request with a
   distinct action; the claim **locks** that evidence to that Verifier, so **no other Verifier can
   claim or decide it**. This is deliberately **not** a separate assignment table (BR-013): the
   claim is a **state on the evidence row** itself. After claiming, the Verifier approves or
   rejects; the decision writes the evidence status, `reviewer_id`, `approved_level` and `reason`
   directly (BR-013/BR-014).

5. **No release.** A claim is **permanent** for the MVP: it is never released, timed out, or
   re-openable — not on suspension, not by an Administrator. A claimed-but-undecided request simply
   stays with that Verifier (an operational concern, not a product one, in the MVP).

6. **Separation of duty preserved.** A Verifier can **never decide their own evidence** (BR-012),
   and an **Administrator role alone grants no review right** (BR-065). A suspended/revoked Verifier
   cannot see, claim or decide.

7. **Administrator's FR-004 role shrinks to supervision.** The Administrator may **suspend or
   revoke** a Verifier (BR-011 keeps the role separate from Admin); invite/assign-domain are
   removed from scope.

**Rationale.** Seeding removes an admin workflow the product does not need while keeping the
*competence* guarantee BR-011/013/065 require. An expertise-scoped queue plus a permanent claim is
the smallest model that (a) routes each request only to competent reviewers and (b) guarantees
exactly one reviewer per submission without an assignment entity — consistent with BR-013 and the
"no assignment table" note in the logical model.

**Consequences.**

- (+) Expertise still enforced; no admin assign/invite UI or endpoints to build or operate.
- (+) Exactly-one-reviewer is guaranteed by the claim state; no double decisions.
- (+) No assignment table; the claim rides on the evidence row (BR-013).
- (−) A suspended Verifier's claimed-but-undecided requests are **stuck** in the MVP (no release).
- (−) Expertise changes require an operational seed/migration, not an API.

**Doc reconciliation.** This ADR **amends** the previously "Confirmed" framing: FR-004 and UC-009
(drop "invite/assign domains"), BR-011 (Verifier is operator-provisioned, not invited via the app;
expertise remains required), and adds a **claim-lock** rule and acceptance criterion. BR-013,
BR-065, AC-018, SR-BR-002, UC-002 and API-003 keep their "matching expertise / active / not-self"
semantics; only the source of expertise (seed) and the new claim step are added.

**Verification.** Domain: `mayDecide` is true only for an **active, not-owner, expertise-matching**
Verifier, and false for admin-only, suspended, wrong-domain and self. Application: the queue
returns only expertise-matching pending evidence; the first claim wins and a second is refused;
decision sets `approved_level` and updates the profile-skill cache atomically and emits the event.
Architecture tests stay green.

**Related:** ADR-013 (outbox), ADR-014 (per-module schema), ADR-024 (trust projection), ADR-026
(taxonomy & level model); BR-011/012/013/065, SR-BR-002, AC-018, FR-004.
