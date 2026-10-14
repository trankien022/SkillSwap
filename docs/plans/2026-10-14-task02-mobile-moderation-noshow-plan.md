# Implementation Plan — Mobile: Moderation Mirror & Learner No-Show (TASK-02)

**Date:** 2026-10-14  
**Author:** Nhật Anh (Mobile Developer)  
**Task Reference:** `TASK-02-mobile-moderation-mirror.md`  
**Platform:** `apps/mobile` (Expo / React Native, ADR-015)  
**Quality Gate:** `pnpm verify`  

---

## 1. Context & Motivation

Two mobile gaps are addressed in this task:
1. **Unwired action (bug):** `TeachingGateway.reportTeacherNoShow(bookingId)` calls `POST /api/classes/bookings/{bookingId}/no-show`, but no UI button in mobile calls it. The teacher-no-show refund flow (`FR-007` / `AC-024`) is unreachable on mobile.
2. **Missing verifier surface:** Verifiers who log in via the mobile app cannot access their moderation queue or evaluate skill evidence (`GET /verifiers/me/queue`, `POST /skill-evidence/{id}/claim`, `POST /skill-evidence/{id}/decision`).

---

## 2. Key Architectural Decisions (Phase 0)

### 2.1 Where the Teacher No-Show Button Goes
- **Location:** `apps/mobile/src/ui/my-bookings-view.tsx`, in the card footer alongside the existing action controls (**Join room** and **Rate**).
- **Eligibility condition:** Displayed only when `item.state === 'confirmed'`.
- **Contract Gap Analysis:**
  - `learnerBookingItemSchema` in `@skillswap/contracts` (`mobile-my-bookings.ts`) has `roomAccessEligible`, `ratingEligible`, and `hasRated`, but does **not** provide a dedicated `teacherNoShowEligible` boolean.
  - As mandated by the task specification, **we do not fake this condition client-side** and **we do not construct a client-side clock**.
  - The server use-case (`MarkTeacherNoShowUseCase`) authoritatively checks `booking.state === 'confirmed'` and whether the 15-minute window past `startsAt` has elapsed without a teacher join (`isTeacherNoShow`).
  - Gating on `item.state === 'confirmed'` allows the learner to submit the report for their confirmed booking, relying on the server authority.

### 2.2 Reusing `TeachingGateway.reportTeacherNoShow`
- `apps/mobile/src/infrastructure/http/teaching-gateway.ts` already contains `reportTeacherNoShow(bookingId: string): Promise<{ cancelled: boolean }>`.
- We import `TeachingGateway` directly in `my-bookings-view.tsx` and instantiate it with the session's `gatewayClient`.
- We do not duplicate the endpoint logic or create a redundant gateway method.

### 2.3 Refusal vs. Error Semantics
- When the endpoint returns `{ cancelled: true }`: The backend has cancelled the booking and queued refund events. Mobile surfaces a success notice and immediately triggers `coordinator.reload()`.
- When the endpoint returns `{ cancelled: false }`: The server has refused the cancellation (e.g. within the 15-minute window or teacher joined). As documented in the task specification, **this is an informational refusal, not an error**. Mobile displays an informational banner/notice (`colors.info` / slate neutral tone) explaining the rule, without triggering a red error state.
- **No replayed POSTs:** `GatewayClient` does not replay non-401 mutations. No double refund is possible.

### 2.4 Verifier Route & Role Gating
- **Web Mirror:** Long's web route is `/[locale]/verifier`.
- **Mobile Route:** `apps/mobile/app/(features)/verifier.tsx` (navigated via `/(features)/verifier`).
- **Layout Registration:** Registered in `apps/mobile/app/(features)/_layout.tsx` as:
  `<Stack.Screen name="verifier" options={{ title: t('Verifier.title') }} />`
- **Role Gating:**
  - In `apps/mobile/src/ui/profile-view.tsx`, the navigation button to the verifier queue is rendered **strictly** when `user?.role === 'verifier'` (from `MeResponse.role` / `accountRoleSchema`).
  - Non-verifier users never see this entry point.
  - If navigated directly, the gateway handles `403 Forbidden` and displays a real translated error state.

---

## 3. Implementation Phases

### Phase 0: Architecture & Documentation Plan (This Document)
- Establish contract mapping, routing, and refusal handling.
- Land commit:
  `docs(mobile): plan moderation mirror and learner no-show`
  `Record no-show placement, refusal handling, and verifier queue architecture.`

### Phase 1: Wire Learner No-Show Action
- **i18n additions (`vi.json` and `en.json`):**
  - `MyBookings.reportNoShow`: "Báo giáo viên vắng mặt" / "Report teacher no-show"
  - `MyBookings.noShowConfirmTitle`: "Báo giáo viên vắng mặt" / "Report teacher no-show"
  - `MyBookings.noShowConfirmMessage`: "Bạn chỉ có thể báo vắng mặt sau 15 phút từ giờ bắt đầu lớp nếu giáo viên không tham gia. Hệ thống sẽ hoàn credit vào ví nếu hợp lệ." / "You can only report a no-show if the teacher has not joined within 15 minutes of class start. Held credits will be refunded if valid."
  - `MyBookings.noShowConfirmBtn`: "Xác nhận báo" / "Confirm report"
  - `MyBookings.noShowSuccess`: "Đã ghi nhận vắng mặt. Đặt chỗ đã được hủy và hoàn credit." / "No-show recorded. The booking has been cancelled and credits refunded."
  - `MyBookings.noShowRefused`: "Yêu cầu chưa được chấp nhận: lớp học chưa quá 15 phút kể từ giờ bắt đầu hoặc giáo viên đã vào phòng." / "Request not accepted: 15 minutes have not passed since class start or teacher already joined."
  - `MyBookings.noShowError`: "Không thể gửi báo cáo vắng mặt. Vui lòng thử lại sau." / "Could not report teacher no-show. Please try again later."
- **Component changes in `apps/mobile/src/ui/my-bookings-view.tsx`:**
  - Add state for `noShowBookingId`, `noShowRefusalMessage`, `noShowSuccessMessage`, `isReportingNoShow`.
  - Add confirm alert/modal before firing the request.
  - Call `TeachingGateway.reportTeacherNoShow(item.bookingId)`.
  - On `{ cancelled: true }`: show success feedback, clear refusal message, call `await coordinator?.reload()`.
  - On `{ cancelled: false }`: display info refusal feedback (`noShowRefused`).
  - On catch: display error message.
- **Coordinator / View Tests:** Add tests verifying no-show trigger, refusal handling, and reload.
- Land commit:
  `feat(mobile): wire teacher no-show refund action`
  `Add confirm-gated no-show button with server refusal feedback.`

### Phase 2: Verifier Queue & Evidence Decision UI
- **Gateway implementation:**
  - Create `apps/mobile/src/infrastructure/http/verifier-gateway.ts`:
    - `getQueue(query?: VerifierQueueQueryInput): Promise<VerifierQueuePage>` (`GET /api/verifiers/me/queue`)
    - `claim(id: string): Promise<SkillEvidenceView>` (`POST /api/skill-evidence/{id}/claim`)
    - `decide(id: string, input: SkillEvidenceDecisionInput): Promise<SkillEvidenceView>` (`POST /api/skill-evidence/{id}/decision`)
  - Unit tests in `apps/mobile/src/infrastructure/http/verifier-gateway.spec.ts`.
- **UI Screen & Component:**
  - Create `apps/mobile/src/ui/verifier-queue-view.tsx`:
    - Keyset cursor pagination (`nextCursor`, Load More).
    - Status pills with text + color.
    - Evidence details: skill name, category, requested level, evidence type, document ref, submitter ID, submitted date.
    - Claim action button for `status === 'pending'`.
    - Decision modal / action panel for claimed items:
      - Choice: Approve vs Reject.
      - Approved level selector (`beginner`, `intermediate`, `advanced`, `expert`).
      - Reason text input (required for rejection as per `skillEvidenceDecisionSchema`).
    - Immediate refetch on state mutations.
    - Real error surfaces (especially 403 Forbidden).
  - Create route file `apps/mobile/app/(features)/verifier.tsx`.
  - Register route in `apps/mobile/app/(features)/_layout.tsx`.
  - Add entry button in `apps/mobile/src/ui/profile-view.tsx` gated by `user?.role === 'verifier'`.
- **i18n additions (`vi.json` and `en.json`):**
  - Complete `Verifier` namespace with all labels, action buttons, statuses, level choices, and error strings.
- Land commit:
  `feat(mobile): add verifier queue and evidence decision UI`
  `Implement verifier gateway, queue screen, and claim/decision mutations.`

### Phase 3: Parity & Quality Gates
- Run `pnpm verify` (linting, typechecking, tests across all workspaces, dependency cruiser arch rules).
- Ensure 0 warnings and full message parity (`messages-parity.spec.ts`).
- Land commit:
  `chore(mobile): complete task-02 moderation mirror`
  `Pass quality gates and verify contract alignment.`
