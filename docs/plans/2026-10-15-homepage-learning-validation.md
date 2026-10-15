# Learning homepage validation

## Result and scope

The home page now introduces online peer learning through an original illustrated
video lesson, an illustrated subject index, expandable joining guidance, all five
existing trust/payment claims, and a teaching invitation. Both VI and EN have
matching keys. Subject links preserve their category through sign-in and the
catalogue initializes its existing filter from a validated URL category.
No classes, availability, student counts, testimonials or endorsements are invented.
No API, ledger, pricing or verification rules changed.

Taste direction: **Dressed as something else**, seed **421806237**. The borrowed
category is a campus coursebook: SkillSwap's two-sided learning/teaching exchange
becomes facing pages for learning and sharing a skill. Brand type and palette
were retained. The perfume-counter hero and oversized cropped-word showcase
were replaced because they conflicted with the clear product register required
by PRODUCT.md. The interactive element is native journey/trust disclosures plus
working subject discovery. Typography, borders and motion follow DESIGN.md
where it takes priority over Taste defaults.

## Visual critique

ROUND 1

Seen in one second: an approachable peer-learning campus, but not clearly online.
Idea: the campus coursebook makes learning and teaching feel like two sides of one exchange.
Live thing: open a learning stage, inspect a trust rule, choose a subject.
Layout words by section: hero=split scene / subjects=illustrated index /
journey=disclosures / trust=reference / teach=facing pages / footer=wordmark.
Scores (subjective): design 7.2 · usability 7.8 · creativity 7.0 · content 8.0 → overall 7.4.
Caps applied: initial focal-point and shadow failures; initial grade capped at 6.0.
Top three problems:

1. Desktop hero scene showed two peers at one table; generate an online lesson
   with a student wearing headphones and a teacher clearly inside a laptop.
2. Desktop media occupied only 21% of the viewport; enlarge it to a dominant
   34%, while restoring balanced columns on tablet.
3. Footer locale control retained an inherited resting shadow and 12px type;
   remove the shadow and use 14px within the landing page.

ROUND 2

Seen in one second: learn online with another student.
Idea and live thing: unchanged; the video-lesson illustration now states the medium.
Layout words by section: same, with a larger first-screen scene.
Scores (subjective): design 7.8 · usability 8.1 · creativity 7.2 · content 8.0 → overall 7.8.
Caps applied: none after mandatory product-brand exceptions.
Remaining limits: generated illustration is an inviting conceptual scene, not a
record of a real student or actual class. Shared visual styling limits formal
novelty. The page does not show live open classes because that endpoint requires
a session; the index leads to authenticated discovery instead.

## Imagery and provenance

Five original images generated with OpenAI ImageGen for this change, then encoded
as WebP for delivery (approximately 360 KB total source assets):

- `public/learning/online-learning.webp`: online lesson, hero.
- `public/learning/peer-learning.webp`: peers sharing knowledge, teaching invitation.
- `public/learning/programming.webp`: programming subject.
- `public/learning/design.webp`: design subject.
- `public/learning/languages.webp`: language subject.

These are illustrations, never portraits of actual SkillSwap members. Alt text
identifies them as illustrations. The landing footer credits the illustrations
as created for SkillSwap. No external stock photos, licence-dependent assets,
unverified brand affiliations or sample class records were introduced.

## Checks

- Taste baseline: 9 inspector failures and 3 warnings; source lint 12 failures.
- Final new-section source lint: **0 failures, 0 warnings**.
- Final browser inspector: **0 failures, 2 warnings**. Retained header hairline is
  explicitly required by DESIGN.md. No footage is used because the repository
  has no authentic class recording; generated illustrative stills communicate
  online learning without pretending to show a live class.
- Browser: VI/EN at **1440, 768, 390, 360 px**. Images load, headlines fit two
  lines, no horizontal overflow and no unhandled JS errors. Journey and trust
  disclosures open; subject URLs retain category and locale; locale switching
  works; reduced motion removes entrances.
- Browser fixture checks: signed-in subject click reaches the correct catalogue,
  programming/design each filter matching records, and invalid category falls
  back to all classes. API responses and session were intercepted fixtures in
  the test browser only. Real sign-in/backend booking was not exercised.
- Unit tests cover guest subject return URL, signed-in subject destination and
  valid/invalid/ambiguous URL categories. Web suite: **292 passing tests**.

Screenshots and machine-readable browser results are stored locally under
`/Users/trankien/.codex/visualizations/2026/10/15/01a1405f-897a-7262-a6f0-990948da8826/homepage-learning/`.

## Repository and production gate

`pnpm verify` completed with exit code 0: lint (zero warnings), all builds,
typechecks, **1,364 tests** (37 + 162 + 623 + 250 + 292), and dependency rules
(**883 modules / 2,495 dependencies**, no violations).

The production build at localhost:3000 passed the same eight VI/EN viewport
checks and the subject-discovery fixture checks. Production rendering removes
the Next.js development indicator. This verifies the production frontend,
not actual account credentials, class inventory or booking/payment operations.

All changes are local commits on `codex/web-design-refinement`; no push or
deployment. Original untracked deliverables are preserved. Taste working files
are excluded locally using `.git/info/exclude`, not staged into the repository.
