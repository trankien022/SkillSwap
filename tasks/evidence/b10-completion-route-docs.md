# B10 — no completion route in the docs

Date: 2026-11-07
Task: B10 of `../../../2026-11-07-backend-remaining-work.md`

## What was wrong

Six documents told client developers a Teacher ends a class with a `complete` call. The API has
no such route: `classes.controller.ts` declares `Post()`, `Post(':id/bookings')`,
`Post('bookings/:bookingId/confirm')`, `Patch(':id')`, `Post(':id/cancel')`,
`Post('bookings/:bookingId/no-show')`, `Post('bookings/:bookingId/room-access')`,
`Post(':id/start')`, and then the AC-035 comment at the end of the class saying there is
deliberately no completion route. ADR-021 Amendment A removed the capability rather than
guarding it.

Mobile was written against the stale text (mobile audit M6) and still calls it.

## Files changed

| File | Change |
|---|---|
| `docs/plans/SkillSwap-SRS.md` (S12) | endpoint list replaced with the routes that exist, plus the automatic-completion note |
| `docs/plans/2026-10-12-screen-parity-matrix.md` (S12 row) | same |
| `docs/plans/2026-10-12-screen-parity-matrix.md` (D1 reality cell) | keeps the audit's historical finding, but records that the `Post(':id/complete')` mention in the original audit was itself wrong |
| `docs/plans/2026-10-12-screen-parity-matrix.md` (route table §5) | `/complete` dropped from the `/classes/:id/cancel \| /start` row |
| `docs/api/FRONTEND-API-GUIDE.md` | endpoint row deleted; lifecycle prose, ASCII diagram and numbered step now describe automatic completion |
| `docs/api/FRONTEND-API-MAP.md` | endpoint row deleted; the `/start` row carries the correction |
| `tasks/plan.md` | row 19 is no longer an endpoint; it states the rule |
| `docs/plans/2026-10-24-w8-jitsi-runtime-acceptance-plan.md` | step 4 no longer asks a human to end the class |
| `scripts/gen-api-docs.cjs` | the generator's own purpose line said the teacher "completes"; fixed at the source so `pnpm docs:api` cannot reintroduce it |
| `docs/api/classes.md` | regenerated from the above |

## Evidence

- `grep -rn "id/complete" docs tasks` → the only hit is the parity matrix's historical note in
  D1, which quotes the wrong line in order to correct it. Nothing advertises the route.
- `grep -rn "@Post(':id/complete')" .` → no matches, so the claim in the docs cannot be true.
- The AC-035 comment is still at the end of `classes.controller.ts` (unchanged).
- `node scripts/gen-api-docs.cjs` then `git diff` is stable: a second run changes nothing, and
  the only generated change is the purpose line fixed above.

## Not done here (by design)

The mobile caller is deleted by MM1 in the mobile document; this task only stops the docs from
teaching the wrong thing. `git grep -n "id/complete" -- apps/mobile/src` therefore still matches
until MM1 lands — the ordering the task states.
