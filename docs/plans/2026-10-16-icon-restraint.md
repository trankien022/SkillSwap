# Web icon restraint

## Problem
Decorative glyphs repeat labels in metrics, category filters, search controls and dashboard widgets. They compete with class content and create unnecessary visual noise.

## Phase 1 — reduce decoration
Remove metric illustrations, category glyphs, redundant search-field/submit icons and dashboard widget ornaments. Preserve labels, values, layout, focus states, navigation and icon-only controls. Delete unused helpers rather than hide icons with CSS.

## Phase 2 — verify and record
Run the full repository gate and inspect marketplace/dashboard at phone and desktop widths in Vietnamese and English. Keep functional chevrons, calendar navigation, ratings and meeting controls. Record the verified scope and commit each phase separately.

## Results
- Removed decoration from metrics, search, category filters, class metadata/actions, wallet widget, calendar heading and detail escrow notice; deleted unused icon helpers and CSS.
- Retained navigation controls, rating stars and verification cues. Labels, query callbacks and accessibility states remain intact.
- `pnpm verify` passed: lint, build, typecheck, tests and architecture gate (898 modules / 2562 dependencies).
- Chromium checked marketplace and bookings in VI/EN at 360, 768 and 1440 px: all 12 cases have no horizontal overflow or squeezed SVGs. Desktop screenshots visually reviewed.
- Scope: these shared marketplace/dashboard components; no blanket CSS hiding and no mobile app changes.
