# ADR-029: Verifier as a provisioned account role

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-11

**Context.** FR-004 (ADR-027) treats a Verifier as an account with seeded expertise, and its
endpoints are guarded by `@Roles('verifier')`. But the account model predates that rule: FR-001
(ADR-016) defined only `learner | teacher | admin` — in the domain (`ACCOUNT_ROLES`), the shared
contract (`accountRoleSchema`) and the `accounts.role` CHECK constraint. As a result no account can
carry the `verifier` role, so the FR-004 routes are unreachable by any legitimate identity, and the
`me` view cannot represent a Verifier. Separately, the **public `registerSchema`** exposes the whole
`accountRoleSchema` as a *choice*, which already lets anyone self-register as `admin` — a latent
privilege hole that adding `verifier` to the same enum would widen.

**Decision (developer, 2026-10-11).**

1. **`verifier` is a real account role.** Add it to the account role model: the domain
   `ACCOUNT_ROLES`, the shared `accountRoleSchema`, and the `accounts.role` CHECK constraint
   (migration). A Verifier account thus carries `role = 'verifier'` like any other role.

2. **Roles are representation vs. provisioning — split the contract.** Separate the *set of account
   roles* (what an account may be) from the *roles a user may choose at self-registration*. Public
   registration may only create **`learner`** or **`teacher`** (`selfRegistrationRoleSchema`); a
   `verifier` or `admin` account is **provisioned out of band** (operator seed / migration), never
   self-assigned. This also closes the pre-existing `admin` self-registration hole.

3. **Provisioning is operational.** The FR-004 `scripts/seed-verifiers.mjs` (ADR-027) is extended to
   **create or promote the account** with `role = 'verifier'` and to set its expertise — the single
   sanctioned path to a Verifier identity in the MVP. There is still **no admin API** to create a
   Verifier (ADR-027 §1).

4. **The guard validates the role.** `RolesGuard` checks the identity's role against the **known
   account roles** (a bad/unknown role value is rejected) rather than blindly trusting any string in
   the header, closing the enum-blind gap.

5. **No change to authority semantics.** A Verifier's *review* authority is still `active AND
   expertise-matches AND not-owner` (ADR-027, AC-018); the role only makes the identity expressible
   and routable.

**Rationale.** The account model must express every role the system routes on, or the routes are
dead — but "what a role is" and "what a public user may pick" are different concerns, and conflating
them created the admin hole. Splitting the schema lets `verifier` exist as a role while keeping
elevated roles provisioning-only. Fixing the guard makes the role check meaningful.

**Consequences.**

- (+) FR-004 verifier endpoints become reachable by a genuine `verifier` account; `me` can show it.
- (+) Public registration can no longer mint `admin` (or `verifier`).
- (+) The guard rejects unknown roles instead of trusting the header verbatim.
- (−) A schema/migration change and an ops provisioning step to operate.
- (−) A previously self-registerable `admin` is no longer self-registerable — intended, but a
  behavioural change to FR-001 to note for clients.

**Verification.** Domain/contract: `verifier` is a valid role; `registerSchema` rejects `admin` and
`verifier`. Persistence: an account row with `role = 'verifier'` is accepted; others rejected by the
CHECK. Application: a seeded verifier logs in, calls the queue/claim/decision routes. Guard: an
unknown role is refused. Architecture tests stay green.

**Related:** ADR-016 (local accounts), ADR-027 (verifier expertise & claim), ADR-028 (evidence
history); BR-011 (Verifier is a separate, matching-expertise group), FR-001, FR-004, NFR-009.
