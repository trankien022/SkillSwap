# ADR-026: Skill taxonomy and level model

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-11

**Context.** FR-003 lets a **verified student** submit skill evidence for a skill at a requested
level; FR-004 decides it and FR-005 (publish gate) and FR-006 (discovery) read the result. All of
them need a shared answer to two questions the SRS marks as OQ-001 (*"Skill taxonomy structure and
search granularity… Exact category tree, free-text/tag hybrid, search index behavior"*): **where do
skills come from**, and **how is a skill level expressed**. FR-003 hard-requires that evidence
reference a **known** skill, so the taxonomy must exist before any submission is allowed.

OQ-001 is owned by the Product Owner. This ADR records the **developer's decision** for the FR-003
scope (it also governs FR-004/FR-005/FR-006); the agent did not choose it.

**Decision (developer, 2026-10-11).**

1. **Taxonomy source — managed catalogue (1a).** Skills live in a **managed, admin-seeded `skills`
   catalogue** owned by the `skill-verification` module (`skill_verification` schema). There is **no
   free tagging** in the MVP: evidence and classes must reference a skill that already exists. A
   submission naming an unknown skill is rejected (`UnknownSkillError`). Candidates cannot create
   skills; seeding is an administrative/ops concern, out of scope for FR-003's code (the module
   consumes the catalogue).

2. **Structure — two-level tree (B).** The catalogue is a **2-level tree: category → skill**. A
   `skills` row has a `category` (a fixed, admin-seeded grouping, e.g. *Languages* → *IELTS*;
   *Programming* → *React*). The category exists so **FR-006** can browse/filter by category;
   FR-003 only needs the skill identity. Depth is exactly two levels in the MVP (no deeper nesting).

3. **Level model — fixed ordered scale (2a).** A skill level is a **fixed ordered scale**:
   `beginner < intermediate < advanced < expert`. `requested_level` (what the candidate asks for)
   and `approved_level` (what the Verifier grants, FR-004) are values on this scale. The scale is
   **ordered** so AC-016 (a requested *upgrade* compared against the current effective level) and
   the FR-005 gate (Teacher's approved level must *cover* the class's target level) can compare
   levels. Evidence with a level outside the scale is rejected (`InvalidLevelError`).

4. **Search granularity — deferred to FR-006.** The exact search behaviour (free-text index,
   ranking, diacritic handling) belongs to **FR-006's own Phase 0** and is **not** decided here.
   FR-003 does not depend on it; recording it as still-open is the honest state rather than
   inventing an index now.

5. **`profile_skills` is the effective-level cache.** A `profile_skills` row links a profile to a
   skill and caches the **effective approved level** — `NULL` until a Verifier approves
   (FR-004). The catalogue and the level scale are the shared contract for FR-003/004/005/006;
   the effective-level rule itself is FR-004's decision and is not pre-empted here.

**Rationale.** A managed catalogue makes "known skill" a checkable invariant (FR-003's hard
requirement) and keeps FR-005/FR-006 aligned on one authoritative set; a fixed ordered scale makes
both the AC-016 upgrade comparison and the FR-005 coverage check well-defined integer-free
comparisons. The two-level tree gives FR-006 a browse axis without inventing deeper taxonomy the
product does not need yet. Deferring search granularity avoids inventing an index the discovery FR
may reshape.

**Consequences.**

- (+) "Known skill" is enforceable; evidence/classes share one catalogue.
- (+) Ordered levels make AC-016 and the FR-005 gate comparisons unambiguous.
- (+) FR-006 gets a category axis to browse; no free-tag sprawl or moderation burden.
- (−) Seeding skills/categories is an operational task; a candidate cannot invent a niche skill.
- (−) Search index/ranking stays open until FR-006 decides it.

**Verification.** Domain: `assertKnownSkill`/level-scale validation reject an unknown skill and an
out-of-scale level; the catalogue is queryable by id and category. Application: submitting evidence
for a known skill at a valid level creates a `profile_skill` (level `NULL`) and a `pending` evidence
version. Architecture tests stay green.

**Related:** ADR-013 (outbox), ADR-014 (per-module schema), ADR-023 (student verification), ADR-024
(cross-module trust projection), ADR-027 (verifier expertise & claim — governs *who may decide*, the
counterpart to this ADR's taxonomy), FR-003/FR-004/FR-005/FR-006.
