# Web design refinement

Scope: the Next.js client. Follow PRODUCT.md and DESIGN.md over conflicting
Taste Skill suggestions. Preserve system sans, slate/emerald, flat surfaces,
pill primary actions, real API state and all role guards. No new capabilities.

## Audit

- Landing: centered generic headline, oversized green emphasis, competing green
  CTAs, repeated trust claims and unsupported school-system affiliation copy.
- Catalogue: decorative gradient covers, nested teacher boxes and floating
  badges obscure the actual teacher, schedule and price.
- Shared navigation: filled active pills and narrow targets; desktop links can
  crowd the account controls. Typography loads unused external display fonts.
- Dashboard/auth: repeated icon tiles, unrelated accent colors and an
  unattributed testimonial weaken the student-to-student voice.

## Phase 1 — Shared foundation

Commit shared typography, focus, numeric alignment, reduced motion, solid
headers and quieter navigation. Preserve role-specific links and session state.
Acceptance: visible keyboard focus, active route named, responsive navigation,
no framework/library migration. Check web tests and typecheck.

## Phase 2 — Landing

Commit a left-aligned editorial introduction with a numbered learning journey,
one main action and a compact verification/credit reference. Rewrite vi/en copy
to describe manual verification honestly. Retain all assurance facts and real
destinations. Acceptance: readable at 360 px, complete locale parity, no fake
students, endorsements, statistics or school affiliations. Check existing tests.

## Phase 3 — Product surfaces and verification

Commit restrained catalogue entries that prioritize real data, a corrected
search grid, a flat dashboard metric strip, and quieter auth presentation.
Remove decorative gradients, excess shadows and scale effects across web
components; retain semantic warning/danger colors. Localize copy changed here.
Acceptance: search, filters, auth tabs and links still work; status text remains;
price values and all API/business behavior remain intact.

Validate landing/auth/catalogue plus signed-out product routes at desktop and
360 px in a browser. Use test fixtures only inside browser interception when
needed to exercise authenticated visual states; label that evidence separately.
Run pnpm verify before reporting completion. Record any environmental blockers
and runtime flows not exercised. Preserve unrelated untracked deliverables.
