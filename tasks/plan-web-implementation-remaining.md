# Plan: Web Remaining Implementation (`W1`–`W14`)

- **Date:** 2026-11-08
- **Branch:** `feat/web-implementation-remaining`
- **Base commit:** `2a6e27a` (`origin/feat/backend-remaining-work-and-client-fixes`)
- **Source specification:** `2026-11-07-web-implementation-remaining.md` (*Web — what to build next*, prepared for Nhat Anh)

## Context & Status

Backend work (`B10`, `B1`–`B7`) and frontend defect fixes (`P0`, `P1` shared `lib/marketplace/time-filter.ts`) have already landed on the base branch. Several tasks in the specification (`W9`, `W10.1`, `W10.2`) remain explicitly blocked on unbuilt backend endpoints (`B8` student document stream + ADR-023 amendment, student-verification history endpoint, and `B9` skill-verification certificate upload target).

All actionable web tasks below will be implemented and committed in dependency order, with each phase landing as its own commit and passing `pnpm verify`.

---

## Phases & Commits

### Phase 1 — `W11`: Do not put a paragraph in the checkout heading
- **Commit:** `fix(web): show the class title, not its description, at checkout`
- **Scope:**
  - `apps/web/src/app/[locale]/classes/[id]/checkout/page.tsx`: pass `classTitle: classDetail.title` instead of `classDetail.description || classDetail.skillName || ''`.
  - Add/update checkout page tests to assert `classDetail.title` is used as the class heading.
  - Confirm `git grep -n classDetail.description -- apps/web/src/app` returns nothing.

### Phase 2 — `W1`: Make every marketplace filter either work or say why not
- **Commit:** `fix(web): make every marketplace filter either work or say why not`
- **Scope:**
  1. `this-weekend`: already fixed in `apps/web/src/lib/marketplace/time-filter.ts`; verify single definition and tests in `http-gateway.test.ts` and `mock-gateway.test.ts`.
  2. `university`: `schoolCode` is `null` on the wire (`B4` exposes free-text `schoolName` only). Render `#university-select` disabled (`disabled` + `aria-disabled="true"`) with a visible localized explanation in `en.json` and `vi.json`. Keep `verifiedOnly` enabled.
  3. `formats`: change `DEFAULT_QUERY.formats` in `apps/web/src/lib/marketplace/types.ts` from `['one-on-one', 'group']` to `[]` so empty selection means "all formats" and ticking a single checkbox narrows results.
  4. Duplicate keyword filter: remove the redundant client-side `if (query.keyword && ...)` block in `apps/web/src/lib/marketplace/http-gateway.ts` so server-side description/title matches are not discarded on the client.
  5. Update `SearchHub.test.tsx`, `http-gateway.test.ts`, and `mock-gateway.test.ts`.

### Phase 3 — `W2`: Render class-detail sections only when they have content & use real seat counts
- **Commit:** `fix(web): render class-detail sections only when they have content`
- **Scope:**
  - `PrerequisitesSection.tsx` & `ClassDetailContent.tsx`: omit prerequisites section when `item.prerequisites.length === 0`.
  - `SyllabusSection.tsx` & `ClassDetailContent.tsx`: omit syllabus `<ol>` timeline when `item.syllabus.length === 0`; omit section entirely if both `description` and `syllabus` are empty.
  - `TeacherDossierSection.tsx`: omit empty school line when `item.schoolName === null`; omit credentials block when `item.teacherCredentials.length === 0`.
  - `ScheduleSection.tsx` & `StickyBookingCard.tsx`: replace `formatSeats(...)` with `item.availableSeats` (falling back to `Marketplace.card.availabilityUnknown` when `null`, and `isFull = item.availableSeats === 0`).
  - Delete `formatSeats` from `apps/web/src/lib/marketplace/mock-data.ts` and its test in `ClassCard.test.tsx`.

### Phase 4 — `W12`: Delete unused `toClassDetailView` derivation
- **Commit:** `refactor(web): delete the detail-view derivation nothing renders`
- **Scope:**
  - Delete `toClassDetailView`, `DERIVED_PREREQUISITES`, `DERIVED_CREDENTIALS`, and `toDerivedSyllabus` from `apps/web/src/lib/marketplace/api-mapping.ts`.
  - Remove corresponding dead tests from `apps/web/src/lib/marketplace/api-mapping.test.ts` and `apps/web/src/components/marketplace/ClassDetailContent.test.ts`.

### Phase 5 — `W6`: Show verifiers the evidence they are deciding on
- **Commit:** `fix(web): show verifiers the evidence they are deciding on`
- **Scope:**
  - `apps/web/src/components/verifier-queue.tsx`:
    - Render `item.description` when non-null with `break-words` so long descriptions wrap cleanly at 360 px.
    - Render `item.documentRef` when non-null as text with an explicit localized notice that the document cannot be opened yet (not a dead link).
    - Remove raw `item.ownerId` display.
    - Format `item.submittedAt` using the active locale (`new Date(item.submittedAt).toLocaleString(locale)`).
  - Add unit tests in `apps/web/src/components/verifier-queue.test.tsx`.

### Phase 6 — `W3`: Show the teacher's class title everywhere
- **Commit:** `feat(web): show the teacher's class title everywhere`
- **Scope:**
  - `apps/web/src/lib/teacher/dashboard-view-model.ts`: remove stale comment claiming no title column exists; add `title: string` to `TeacherClassItem` and `ClassEditDraft`; include `title: draft.title.trim()` in `toUpdateClassInput`.
  - `apps/web/src/app/[locale]/instructor/page.tsx`: render `item.title` as the class card `<h3>` heading (and `item.description` below when present); add validated Title input (`!titleOver(draft.title)`) to `ClassEditPanel`.
  - Update `apps/web/src/app/[locale]/instructor/page.test.tsx` and locale files (`en.json`, `vi.json`).

### Phase 7 — `W4`: Show the class level beside the format chip
- **Commit:** `feat(web): show the class level beside the format chip`
- **Scope:**
  - `apps/web/src/components/marketplace/DetailHeader.tsx`: render the translated level chip (`Marketplace.card.levels`) beside the format chip when `item.level !== null`.
  - Add unit test coverage verifying the level chip renders when `item.level` is non-null and is omitted when `null`.

### Phase 8 — `W5`: Verify and pin real rating aggregates, reviews, filter, and sort
- **Commit:** `feat(web): display real rating aggregates and reviews`
- **Scope:**
  - Verify `DetailHeader.tsx` and `ReviewsSection.tsx` render real `ratingAvg`, `ratingCount`, and `reviews`.
  - Add explicit unit tests in `apps/web/src/lib/marketplace/http-gateway.test.ts` pinning `minRating` filtering (unrated excluded when `minRating > 0`) and `sort: 'rating'` ordering (unrated sorted last via `?? -1`).

### Phase 9 — `W7`: Persist notification read state and localize the inbox
- **Commit:** `feat(web): persist notification read state and localize the inbox`
- **Scope:**
  - `apps/web/src/lib/notifications/api-notifications.ts`:
    - Delete unused mapper presentation fields and all hardcoded Vietnamese strings (`'Hệ thống'`, `'Ví & Tín chỉ'`, `'Xác minh hồ sơ'`, `'Lớp học'`, `'Gần đây'`, `'Hôm qua'`, `'Mã sự kiện'`).
    - Add `markNotificationRead(id)` (`POST /notifications/:id/read`) and `markAllNotificationsRead()` (`POST /notifications/read-all`) returning the updated server `unreadCount`.
  - `apps/web/src/app/[locale]/notifications/page.tsx`:
    - Use `result.unreadCount` from the server for the badge and `<Navbar unreadNotificationsCount={unreadCount}>`.
    - Wire single-item and mark-all buttons to the new POST helpers so read state persists across reloads.
  - Update `apps/web/src/lib/notifications/api-notifications.test.ts`.

### Phase 10 — `W8`: Page the marketplace by cursor and filter on the server (Option A)
- **Commit:** `feat(web): page the marketplace by cursor and filter on the server`
- **Scope:**
  - `apps/web/src/lib/marketplace/types.ts`: add `cursor?: string` to `MarketplaceQuery` and `nextCursor: string | null` to `MarketplacePage`.
  - `apps/web/src/lib/marketplace/http-gateway.ts` & `mock-gateway.ts`: pass `cursor` to `GET /classes` when present, preserve server `nextCursor`, and support cursor slicing in `MockMarketplaceGateway`.
  - `apps/web/src/lib/marketplace/api-mapping.ts`: delete unused `toMarketplacePage`.
  - `apps/web/src/components/marketplace/MarketplaceClient.tsx` & `PaginationBar.tsx`: accumulate items across cursor pages via a "Load more" control, reset accumulated items and cursor when any filter changes, and show an explicit empty state when `items.length === 0`.
  - Update `http-gateway.test.ts` and `mock-gateway.test.ts`.

### Phase 11 — `W13`: Pin the `/operations` page composition (Option A)
- **Commit:** `test(web): pin the operations page composition (A)`
- **Scope:**
  - Add `apps/web/src/app/[locale]/operations/page.test.tsx` asserting that `/operations` renders `AdminDashboard` and `SuspendedAccountsSection` and does not inline a duplicate verification queue.
  - Document the outbox dead-letter UI gap (`GET /operations/outbox/dead-letters` and `POST /operations/outbox/dead-letters/:id/replay`) in this plan as a tracked follow-up item.

### Phase 12 — `W10`: Close the remaining verification, evidence, and catalogue gaps
- **Commit:** `fix(web): close the remaining verification, evidence and catalogue gaps`
- **Scope:**
  - `W10.3`: remove hardcoded `'Peer student'` from `apps/web/src/lib/dashboard/api-my-bookings.ts` and any other occurrences under `apps/web/src`; make `teacherSchoolLabel` nullable and only render the school parenthetical in `SessionCard.tsx` when non-null.
  - `W10.4`: omit `state=published` in `HttpMarketplaceGateway.fetchClasses` so the backend's marketplace mode (`published` and `full` classes starting ≥ now + 24h) surfaces `full` classes marked with `0` available seats; document the decision in code and pin it with a test in `http-gateway.test.ts`.
  - `W10.1` & `W10.2`: ensure student-verification copy accurately reflects that only the latest submission is returned (history endpoint not in SRS/backend), and record that `W10.2` (web certificate upload) is blocked on backend `B9`.

### Phase 13 — `W14`: Record the `NFR-007` accessibility pass for classroom and operations
- **Commit:** `docs(tasks): record the NFR-007 accessibility result for classroom and operations`
- **Scope:**
  - `apps/web/src/components/classroom/ChatPanel.tsx`: add `aria-live="polite"` and `aria-relevant="additions"` to the message list `<ol>` and cover with a test in `ChatPanel.test.tsx`.
  - Audit `/bookings/[id]/live` and `/operations` against `NFR-007` (keyboard navigation, focus rings, `aria-label` on icon buttons, status text + colour, 360 px viewport) and record the dated verification report in `tasks/evidence/w14-classroom-operations-accessibility.md`.

---

## Tracked Blockers & Follow-up Items

1. **`W9` (Admin student-card image preview on `/operations`):** Blocked on ADR-023 amendment and backend `B8` (`GET /student-verifications/:id/document` streaming endpoint).
2. **`W10.1` (Full student-verification history list):** No confirmed requirement in SRS (`FR-002` covers single flow); backend only exposes `GET /student-verifications/me`.
3. **`W10.2` (Web certificate upload for skill verification):** Blocked on backend `B9` (`skill-verification` storage upload port).
4. **Outbox Dead-Letter Admin UI (`W13` Option A follow-up):** Backend routes `GET /operations/outbox/dead-letters` and `POST /operations/outbox/dead-letters/:id/replay` exist on the gateway, but no web component calls them yet. Tracked here as a separate future admin feature.
