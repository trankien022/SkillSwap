# TASK-04 — Mobile class detail read plan

## Scope

Wire the existing authenticated `GET /api/classes/{id}` read into the learner class-detail screen and the teacher's class-detail screen. Remove list-page scans used to resolve a known class ID, add regression coverage for the changed behavior, correct any confirmed React Native text rendering issue, and update the mobile API mapping. Do not add `/health` or `*/status` calls and do not extend the Expo base-URL mock fallback.

## Phase 0 findings

### Dedicated detail read and visibility

- `apps/api/src/modules/live-class/internal/adapter/in/web/class-detail.controller.ts:33-55` declares `GET /classes/:id`, requires an authenticated caller, passes the UUID and caller identity to the query, and validates the response with `classDetailViewSchema`.
- `apps/api/src/modules/live-class/internal/application/query/get-class-detail.query.ts:44-62` allows draft visibility only to the owning teacher and restricts terminal/in-progress classes to the teacher or a caller with a booking.
- `apps/api/src/modules/live-class/internal/application/query/get-class-detail.query.spec.ts:83-112` covers an owner's draft and published/full visibility. There is no draft-read backend gap for the teacher's own class.
- `packages/contracts/src/mobile-class-detail.ts:52-66` defines `classDetailViewSchema`; its view includes the lifecycle `state` and class fields needed by the teacher detail form. It also includes `ownBooking` for the authenticated caller.
- `apps/mobile/src/infrastructure/http/booking-http-gateway.ts:27-33` already implements `getClassDetail(classId)`, URL-encodes the ID, and parses the response with `classDetailViewSchema`. Reuse it; do not add a duplicate request.

### Current mobile gaps

- `apps/mobile/src/ui/class-detail-view.tsx` already uses `ClassDetailCoordinator`, which calls `BookingHttpGateway.getClassDetail`; the catalogue read in that screen is only for resolving skill names. Keep that skill lookup and do not use it to resolve a class ID.
- `apps/mobile/app/(features)/teaching/[id].tsx` currently calls `ClassReadGateway.getClassesPage({ teacherId: 'me', limit: 50 })` and scans the returned page. Replace that ID lookup with the existing dedicated read so classes beyond the first 50 are not hidden.
- The teaching screen reloads with `useFocusEffect`; preserve that behavior and its server-driven `canEdit` / `canCancel` checks based on `state`.

### View/Text inspection

The task's cited `my-bookings-view.tsx:453-455` no longer matches the described unsafe structure in this checkout: line 453 is a `<Text>` child of `<Pressable>`, and the no-show/room controls around lines 539-565 render labels inside `<Text>`. The reported bare string sibling to `<ActivityIndicator>` is not present in the inspected current section. Do not make a speculative rendering change; re-check the exact area while implementing and fix only if an actual bare text child of `<View>` is found.

## Phases

### Phase 1 — Wire dedicated reads

- Change the teaching detail screen to load `ClassDetailView` through `BookingHttpGateway.getClassDetail(classId)`; remove `ClassReadGateway` paging and ID scanning from this screen.
- Confirm the learner class-detail coordinator continues to use the dedicated read for initial load and authoritative post-booking reconciliation. Retain the skill catalogue request solely for skill-name lookup.
- Preserve focus reload, server-provided lifecycle state, existing mutation behavior, translated error/not-found states, and no-mock behavior.

### Phase 2 — Regression tests and verified UI fix

- Add/extend Jest coverage proving `getClassDetail` calls `GET /classes/{encodeURIComponent(id)}` and Zod-parses through `classDetailViewSchema`.
- Cover failure behavior so a failed dedicated read surfaces an error and does not fall back to a fabricated/list-derived class.
- Cover the teaching detail loader with a class that would be beyond the former first-50 page, using a mocked dedicated-read response rather than client-side paging.
- Confirm existing POST retry behavior is not changed; add a focused regression only if the current tests do not already establish that POST is not replayed after 401.
- Re-inspect and fix the `View`/`Text` issue only if the unsafe child exists in the current source.
- Add any new user-facing strings to both `apps/mobile/src/i18n/vi.json` and `apps/mobile/src/i18n/en.json`.

### Phase 3 — Coverage documentation

- Update `SkillSwap-MOBILE-FE-API-Mapping.md` §3 to mark `GET /api/classes/{id}` as used by both learner and teaching detail screens, and update §4 to remove the resolved gap.

## Verification

- Run focused mobile Jest tests for the gateway and teaching detail behavior.
- Run `pnpm --filter @skillswap/mobile build` and the repository `pnpm verify` gate before claiming completion.
- Review the diff for mocked class data, stale catalogue ID scans, untranslated strings, unsafe text children, and accidental `/health` or `*/status` calls.

## Commit sequence

1. Phase 0: `docs(mobile): plan dedicated class detail reads`
2. Phase 1: `feat(mobile): use dedicated class detail reads`
3. Phase 2: `test(mobile): cover dedicated class detail reads`
4. Phase 3: `docs(mobile): update class detail API coverage`
