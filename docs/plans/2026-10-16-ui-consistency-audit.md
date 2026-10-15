# UI consistency audit and fixes

Scope: existing web and mobile interfaces, following PRODUCT.md, DESIGN.md,
ADR-015 and confirmed SRS FR-001–FR-018, NFR-001/NFR-002/NFR-007.
Preserve API contracts, authorization, booking and financial behavior.

## Phase 1 — Inventory and baseline (documentation commit)

- Read repository contracts and inspect shared navigation, icons, cards, controls
  and feature screens on both clients.
- Record reproducible defects before editing; distinguish code findings from
  browser/device observations.
- Inspect public and available authenticated states in both locales at 360,
  390, 768 and desktop widths. Keep screenshots outside tracked source.

## Phase 2 — Web corrections (separate implementation commit)

- Correct verified icon sizing, alignment, missing glyphs and accessibility names.
- Fix card/text/CTA overflow and responsive alignment at the source component.
- Exercise navigation and visible controls; preserve honest loading, empty,
  disabled and error states. Avoid introducing unsupported feature behavior.
- Check changed components with existing tests and browser screenshots.

## Phase 3 — Mobile corrections (separate implementation commit)

- Inspect native tab icons, shared controls and cards for clipping, wrapping,
  touch areas and loading/disabled feedback.
- Correct shared defects using existing tokens and platform primitives.
- Run mobile tests/typecheck; record actual simulator availability and avoid
  claiming native visual acceptance from source inspection alone.

## Phase 4 — Verification and evidence (documentation commit)

- Run pnpm verify and fix regressions introduced by this work.
- Recheck available browser routes in both locales, narrow and wide viewports,
  reduced motion and keyboard navigation. Note unavailable authenticated or
  native states explicitly.
- Record changes, commands, outcomes and remaining limitations below.

## Findings and evidence

Baseline: branch codex/web-design-refinement; only pre-existing untracked
deliverables/ and docs/SWD392_Week6_MidTerm_Checkpoint.pdf. These are excluded.
Graphify lookup was noisy (skill documentation dominates); source inspection
is the authoritative follow-up for UI changes.

Source findings pending runtime verification:
- Web uses a remote Material Symbols font alongside inline SVGs; verify behavior
  when remote font loading is unavailable.
- Mobile AppButton uses ink on a dark secondary button while busy, reducing
  spinner visibility; button labels have no vertical padding for scaled text.
- Mobile class metadata rows lack wrapping and marketplace chips lack a maximum
  width, allowing long labels or enlarged text to escape the card.


## Implemented corrections

- Prevent decorative SVG glyphs shrinking in flex rows; the authenticated
  baseline had 33 glyph observations below 10 px. The repeated matrix has zero.
- Bundle the installed Material Symbols outline font and its license locally.
  Remove external font requests and keep square glyph cells with explicit font
  metrics; no additional package dependency is introduced.
- Let pagination wrap; make toast positioning fit narrow screens, remove hidden
  toast contents from the accessibility tree and improve its icon contrast.
- Replace the unconditional green schedule-valid badge with the lead-time rule.
  The existing eligibility checklist still computes the actual draft status.
- Expose selected class format/duration states, translate capacity controls,
  category and pagination labels, and use native current-date semantics.
- Display actual group capacity and localized duration on class details instead
  of a hard-coded four-person limit or Vietnamese text in English.
- Reflect parent filter resets in search fields and restart new searches at page
  one. Browser interaction confirmed an empty keyword after reset at 360 px.
- Isolate Next.js development output in .next-dev, with matching Git, ESLint and
  Prettier exclusions. The original production process referenced unavailable
  static files (HTTP 400); after rebuilding/restarting, both page CSS assets
  returned HTTP 200. Preview and production no longer overwrite one directory.
- Mobile: fix dark secondary-button pending spinner contrast; permit larger
  labels/inputs to grow; bound chips/status pills and wrap class/profile rows.
- Mobile: reflow wallet columns, marketplace price/action rows and search fields.
  Keep exact prices and rating text available when system text grows.
- Mobile: use consistent outline tab symbols, supply web mappings and explicit
  translated tab accessibility labels. Hide decorative icon descendants.
- Mobile: render wrapping tab labels and adapt bar height to font scale and safe
  area. At 360 dp / font scale 1.5, labels and search fields are readable.

## Verification record

- Full gate: pnpm verify passed after the final source edits (lint, all builds,
  typechecks, tests and architecture checks).
- Tests: contracts 37; gateway 162; API 623; mobile 253; web 304.
- Architecture: 898 modules / 2,562 dependencies, no violations.
- Web: 9 authenticated learner/teacher routes × VI/EN × widths 360, 390, 768,
  1440 = 72 observations; zero horizontal overflows and zero squeezed glyphs
  under 10 px in the repeated matrix.
- Routes: classes, bookings, wallet, verification, skills, instructor,
  notifications, teach/classes/new and an actual class detail.
- Public home/auth, signed-out feature states and status were also inspected.
- Admin and verifier screens inspected at 360 px in VI/EN with reduced motion
  and Google Fonts blocked. Local glyph font remained available.
- Native baseline: Android API 37 AVD, five primary tabs and live demo API data.
  The initially installed app was a release binary; it was not accepted as proof
  of new source. Installed the existing debug client without clearing data and
  connected it to Metro to verify the current source, including 360 dp / 150%
  text reflow. Emulator display/font settings restored afterwards.
- Local screenshots, viewport observations and complete final gate output are
  saved under .codex/artifacts/ui-audit-2026-10-16/ (ignored development evidence).

## Limits of this audit

- iOS, tablets, maximum OS font size and native landscape were not visually
  accepted. The app currently declares portrait orientation and light mode.
- Live Jitsi/media, real payment/payout, destructive admin actions and every
  possible error/data combination were not exercised by this visual audit.
  No claim of exhaustive business-flow acceptance is made.
- Existing untracked presentation/document deliverables were preserved.
