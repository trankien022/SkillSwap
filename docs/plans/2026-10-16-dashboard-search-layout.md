# Dashboard metrics and marketplace search layout

Follow-up to the two supplied screenshots. Preserve existing labels, API data,
search/filter callbacks and DESIGN.md tokens.

## Phase 1 — Plan

Record the scope before implementation. The metric strip lacks distinct card
boundaries and consistent internal alignment. Search fields have uneven visual
heights, oversized empty tracks and small focus targets.

## Phase 2 — Implement (one focused commit)

- Render four consistent metric cards with a small decorative outline icon,
  aligned values/units and a separate hint row. Use one column on small phones,
  two on tablet and four on wide screens; allow long values/text to wrap.
- Give search fields, select and filter trigger consistent heights, padding,
  borders and focus feedback. Use a stacked mobile layout, two tablet columns
  and four desktop columns. Keep the submit button centered and easy to reach.
- Preserve search reset/pagination behavior and accessible field labels.

## Phase 3 — Verify and record

- Run existing web tests and pnpm verify.
- Inspect both components with live demo data in VI/EN at 360, 768 and 1440 px.
- Check overflow, icon sizing, form submit and filter reset. Rebuild/restart the
  local production preview so the user sees the updated result.
