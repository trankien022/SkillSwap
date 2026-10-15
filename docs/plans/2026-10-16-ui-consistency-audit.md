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
