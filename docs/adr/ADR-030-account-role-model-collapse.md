# ADR-030: Collapse the account role model to user / verifier / admin

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-11

**Context.** The account model (ADR-016) defined four roles: `learner | teacher | verifier | admin`.
BR-063 states one account may **both learn and teach** ("một verified student có thể vừa học ở class này
vừa dạy một skill đã verify ở class khác"), and BR-065/BR-008 gate *teaching* on **verification +
approved skill**, not on holding a role. Inspecting the shipped code confirms this: the **only**
role guards in the whole API are `@Roles('admin')` (student-verification decisions) and
`@Roles('verifier')` (skill-evidence claim/decision/queue); there is **no `@Roles('teacher')` or
`@Roles('learner')`** anywhere, and `POST /api/classes` (publish) carries no `@Roles` (its
verification gate is the still-pending FR-005 `TODO`). So `learner` and `teacher` are **not
enforced identities** — they describe what a user *does*, which the system already derives from
verification state. Keeping them as roles is misleading and invites a wrong mental model (and an
unnecessary "role-view switch", PRD §6.1).

**Decision (developer, 2026-10-11).**

1. **Role set collapses to `user | verifier | admin`.** `user` is the ordinary account role;
   `verifier` and `admin` are the two privileged roles that actually gate access. `learner` and
   `teacher` are **capabilities**, not roles: any `user` learns, and a `user` who is a verified
   student with an approved skill may submit evidence and publish classes (per BR-063/BR-065,
   enforced by FR-005 — never by role).

2. **Self-registration creates `user` only.** `registerSchema.role` is removed/defaulted to `user`,
   or restricted to `user`; `verifier`/`admin` remain operator-provisioned (ADR-029). This keeps
   the ADR-029 property that privileged roles are never self-assigned.

3. **Hard cut in one migration.** Existing `learner` and `teacher` rows are rewritten to `user`;
   the `accounts_role_check` constraint accepts only `('user','verifier','admin')`. No transitional
   acceptance of the old values (developer decision).

4. **Type/time renames (`learner`/`teacher`) stay only where they mean a *party to a booking/class*,
   never a role.** Booking/class/finance vocabulary (a "Learner" books, a "Teacher" hosts) is
   unaffected — those are domain nouns, not account roles.

5. **Relationships:** roles do not multiply; one account keeps exactly one role. This supersedes the
   role portion of ADR-016 and the `verifier`-role addition of ADR-029 (its provisioning rule is
   preserved).

**Rationale.** A role should denote an access class the system actually branches on. Only `admin`
and `verifier` do. Making `learner`/`teacher` roles created dead values, an impossible-to-satisfy
"both roles on one account" story, and a phantom role-view requirement. Collapsing to `user` +
the two privileged roles is internally consistent with BR-063 and the shipped enforcement.

**Consequences.**

- (+) The role set matches reality; no dead role, no role-view feature to build.
- (+) Registration cannot mint a privileged role; fewer moving parts.
- (−) A breaking change: clients/tokens carrying `learner`/`teacher` must move to `user`; the
  `registerSchema` `role` field is removed/reduced; docs/DBML updated.
- (−) A migration that rewrites existing role values (hard cut).

**Verification.** Domain/contract: only `user|verifier|admin` are valid; `registerSchema` has no
privileged role. Persistence: a row with `role='user'` is accepted, `learner`/`teacher` rejected;
the migration converts existing rows. Application/E2E: a registered `user` logs in, submits
evidence once a verified student, and is refused on verifier/admin routes; a seeded verifier works.
Architecture tests stay green.

**Related:** ADR-016 (local accounts — role set superseded here), ADR-029 (verifier provisioning —
preserved), ADR-027 (verifier authority), FR-001, FR-004, FR-005; BR-008, BR-063, BR-065.
