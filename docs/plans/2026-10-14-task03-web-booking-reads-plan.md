# TASK-03 — Web: Booking reads, verifier admin & FR-014 honesty

- **Owner:** Tấn Hưng
- **Platform:** `apps/web` (Next.js 15, port 3000)
- **Weight:** Medium
- **Date:** 2026-10-14
- **Source of truth:** `tasks/taskbyrole/TASK-03-web-booking-reads.md` (đã đọc) + source contracts
  - `packages/contracts/src/index.ts` (đã đọc các schema liên quan)
  - `apps/api/src/modules/skill-verification/internal/adapter/in/web/verifier.controller.ts` (đã đọc)
  - `apps/web/src/lib/dashboard/api-my-bookings.ts` (đã đọc)
  - `apps/web/src/components/dashboard/SessionCard.tsx` (đã đọc)
  - `apps/web/src/app/[locale]/wallet/withdrawal/page.tsx` (đã đọc)
  - `apps/web/src/lib/api-client.ts` + `apps/web/src/lib/skills/http-gateway.ts` (pattern) (đã đọc)

---

## 1. Tóm tắt các quyết định kỹ thuật (đã chốt với người dùng)

| # | Câu hỏi | Quyết định | Bằng chứng / nguồn |
|---|---|---|---|
| Q1 | Admin tới admin control bằng cách nào (không có list endpoint)? | **Action-by-id + deep link.** Ô input `{accountId}` + ô nhập status, kèm link "Learn more" trỏ tới invitation mailto. Không build list. | xác nhận của user; `verifier.controller.ts` chỉ expose `:accountId/status` + `me/queue` |
| Q2 | `roomCode` + `receiptId` đang fake trên dashboard: xử lý thế nào? | **Xoá hoàn toàn.** Không render nếu backend chưa mint; không build new mock làm replacement. Live join vẫn chạy vì `LiveClassroomContent` đã gọi `POST /classes/bookings/{id}/room-access` và lấy `room` thật. | xác nhận của user; `LiveClassroomContent.tsx:46-52` đã minh hoạ đường đi tới room thật |
| Q3 | `apps/web/src/lib/verification/http-gateway.ts` (file Long tạo trong TASK-01) | **Add-only.** Nếu file chưa tồn tại khi Phase 1 bắt đầu → tạo tối thiểu với chỉ method `setVerifierStatus` (và `getVerifierQueue`/claim/decide nếu cần thiết kế trước) rồi nhường Long tiếp tục. Nếu file đã có → chỉ append, đặt method ở cuối file, không refactor. | xác nhận của user; `HttpSkillsGateway` (`apps/web/src/lib/skills/http-gateway.ts`) là pattern tham chiếu |

---

## 2. Các phát hiện quan trọng từ source (file:line)

| Finding | File | Bằng chứng |
|---|---|---|
| Route param đúng là `accountId` (không `verifierId`) | `apps/api/src/modules/skill-verification/internal/adapter/in/web/verifier.controller.ts:42-58` — `@Post(':accountId/status')` + `@ApiParam({ name: 'accountId' })` + DTO `VerifierStatusChangeDto`. Backend map `verifierId: accountId` qua use-case (line 56) — chú ý: cùng route, **param name trong API path là `accountId`, nhưng use-case dùng key `verifierId`**. Không sao — client chỉ cần path. | verified |
| Status enum | `packages/contracts/src/index.ts:543` — `verifierStatusSchema = z.enum(['active', 'suspended', 'revoked'])` | verified |
| Body schema | `packages/contracts/src/index.ts:569-572` — `verifierStatusChangeSchema = z.object({ status: z.enum(['active','suspended','revoked']) })` — chỉ truyền `{ status }`; **không có `reason`** | verified |
| DTO + `@Roles('admin')` | `verifier.controller.ts:44` — server enforce `@Roles('admin')`. Web phải gate UI theo `me.role === 'admin'` và `callApi` đã trả `403` envelope nếu role sai. | verified |
| Response type | `verifier.controller.ts:50` — trả `VerifierView = { accountId, status, expertise: string[] }` qua `verifierSchema` (`packages/contracts/src/index.ts:561-565`) | verified |
| Role field trên `me` | `packages/contracts/src/index.ts:240-247` — `meResponseSchema.role = accountRoleSchema = z.enum(['user','verifier','admin'])`. `UserProfile.role?: string` ở `apps/web/src/lib/api-client.ts:21` đã có sẵn nhưng type chưa được khoá cứng vào `AccountRole`. | verified; tighten cần thiết |
| `roomCode` fake | `apps/web/src/lib/dashboard/api-my-bookings.ts:36` — `roomCode: item.roomAccessEligible ? \`ROOM-${item.bookingId.slice(0,8)}\` : undefined` + comment "(mock; the real backend mints per booking)". Render ở `SessionCard.tsx:175-193` (UpcomingCard) và `SessionCard.tsx:762-781` (LiveCard). | verified |
| `receiptId` fake | `apps/web/src/lib/dashboard/api-my-bookings.ts:41` — `receiptId: item.state === 'completed' ? \`REC-${item.bookingId.slice(0,8)}\` : undefined`. Render ở `SessionCard.tsx:281-292` (CompletedCard). | verified |
| `roomAccessEligible` đã đến từ contract | `LearnerBookingItemView` (`packages/contracts/src/mobile-my-bookings.ts:...`) — item còn flag, dùng để gate có/không hiển thị CTA "Join room" / copy-code UI. Sau khi xoá fake `roomCode`, vẫn cần `roomAccessEligible` để biết khi nào đáng hiển thị "Mã phòng chưa được cấp" hoặc link "Mở phòng". | verified |
| `LiveClassroomContent` đã mint room | `apps/web/src/components/classroom/LiveClassroomContent.tsx:38-58` — đã gọi `POST /classes/bookings/${bookingId}/room-access` khi mount, parse `room/token/url`. Đường đi end-to-end tới Jitsi đã có — chỉ là dashboard chưa đi đường đó. | verified |
| FR-014 endpoint KHÔNG có | `docs/api/wallet.md` (theo task brief) — chỉ có 5 routes: `balance`, `history`, `top-ups`, `top-ups/{id}`, `top-ups/callback`. Không có `POST /wallet/withdrawals`. `apps/web/src/app/[locale]/wallet/withdrawal/page.tsx` chỉ `getBalance`/`getMe`, không có action gì. | verified |
| i18n keys đang dùng | `apps/web/src/messages/vi.json:392-393` — `Dashboard.card.receipt` + `Dashboard.card.receiptId`; `LiveClassroom.*` đã có sẵn `room`/`materials`. `Admin.*` chưa có — cần tạo nhóm mới. `Wallet.withdrawal` chưa có — cần tạo nhóm mới. | verified |
| `meResponseSchema.role` chưa được khóa cứng trong `UserProfile` | `apps/web/src/lib/api-client.ts:21` — `role?: string` (loose). Để gate admin UI chặt chẽ hơn, có thể đổi sang `role?: AccountRole` (re-export từ `@skillswap/contracts`). | verified |

---

## 3. Phases

> AGENTS.md "Plan before code": mỗi phase là một commit riêng. Phase 0 là plan (file này).

### Phase 0 — Plan (file này)

**Commit:** `docs(plans): task03 web booking-reads plan`

- [x] File `docs/plans/2026-10-14-task03-web-booking-reads-plan.md` đã tạo.
- [ ] Không chạm source code.

---

### Phase 1 — Web verifier admin control (FR-004 / FR-015)

**Commit:** `feat(web): verifier admin status control`

**Touch list (giữ tối thiểu):**
- `apps/web/src/lib/verification/http-gateway.ts` — file mới nếu chưa có (mirror `HttpSkillsGateway`). Nếu Long đã tạo ở TASK-01 và đã có các method khác → chỉ append `setVerifierStatus(accountId, input)` cuối file (không refactor).
  - new: `setVerifierStatus(accountId: string, input: VerifierStatusChangeInput): Promise<VerifierView>` — parse `verifierStatusChangeSchema`, `POST /verifiers/${encodeURIComponent(accountId)}/status`, parse `verifierSchema`, raise `AdminAuthError` cho `401`/`403` (mirror `SkillsAuthError` pattern).
  - Không thêm `getVerifierQueue`/`claim`/`decide` ở task này (đó là TASK-01 của Long).
- `apps/web/src/app/[locale]/admin/verifiers/[accountId]/page.tsx` — new route. Server component, hiển thị form client-side.
  - Gate UI bằng `meResponse.role === 'admin'` (lấy qua `getMe()` ở server). Nếu không phải admin → render `<NotAuthorized />` với i18n key mới.
  - Form client-side: input `accountId` (URL param pre-fill, nhưng cho phép paste), select `status` (`active`/`suspended`/`revoked`), button "Apply".
  - Confirm step cho `suspended`/`revoked` qua `confirm()` window với translated copy — **chưa build modal** (i18n đơn giản, đồng nhất với pattern hiện có của `NoShowModal` chỉ khi cần).
  - Sau mutation → refetch qua gateway, hiển thị VerifierView mới (`status`, `expertise`).
  - Lỗi từ API (403/404/400) hiển thị ra 1 banner dịch lượt — không swallow.
- `apps/web/src/components/admin/VerifierStatusForm.tsx` — component form (client, dùng trong route trên). Pattern: giống `ReviewModal`/`NoShowModal` của `DashboardShell.tsx`.
- `apps/web/src/messages/vi.json` + `apps/web/src/messages/en.json` — thêm nhóm `Admin.verifiers` (`title`, `subtitle`, `accountIdLabel`, `statusLabel`, `active/suspended/revoked`, `applyCta`, `confirmSuspend`, `confirmRevoke`, `notAuthorized`, `forbidden`, `notFound`, `success`, `error`).
- (Optional) `apps/web/src/components/navbar.tsx` — nếu navbar hiện có hiển thị menu admin → thêm link tới `/[locale]/admin/verifiers` cho `role === 'admin'`. **KHÔNG** thêm nếu navbar không có menu admin — chỉ deep-link từ email khác inbox audit.

**Quy tắc:**
- Không tự viết lại `http-gateway.ts` của Long; chỉ append method mới.
- Mọi status pill = text + colour (DESIGN.md, register `product`).
- Touch targets ≥ 44px, mobile-first 360px, no horizontal scroll.
- vn/en never mixed trên cùng 1 screen.
- i18n key nhất quán `Admin.verifiers.*`.

**Tests:**
- Unit test cho `HttpVerificationGateway.setVerifierStatus`: mock `callApi` 200 → parse `verifierSchema`; 401 → throw `AdminAuthError`; 403 → throw `AdminAuthError`; 400 → throw Error với envelope message.
- Có thể đặt vào `apps/web/src/lib/verification/http-gateway.spec.ts` (mirror `http-gateway.test.ts` của skills nếu có — verify pattern).

**Acceptance:**
1. Admin đăng nhập → truy cập `/[locale]/admin/verifiers/{accountId}` → form hiển thị.
2. Nhập `accountId` (URL deep link) + chọn `suspended` → click Apply → confirm dialog → backend đổi status → UI hiển thị `VerifierView` mới (status = `suspended`).
3. Non-admin đăng nhập → truy cập cùng URL → page render `<NotAuthorized />` với text vi/en.
5. Sau khi đổi status, Refetch tự động chứ không patch local.

---

### Phase 2 — Xoá fabricated `roomCode` / `receiptId` (FR-011 honesty)

**Commit:** `fix(web): remove fabricated roomCode and receiptId`

**Touch list:**
- `apps/web/src/lib/dashboard/api-my-bookings.ts`:
  - Bỏ dòng 36 (`roomCode: ...`).
  - Bỏ dòng 41 (`receiptId: ...`).
  - Bỏ comment "(mock; the real backend mints per booking)" + comment "derived: receipts are numbered..." (dòng 38-41).
  - Không thêm field khác — chỉ xoá. UI sẽ render với `roomCode === undefined` và `receiptId === undefined`.
- `apps/web/src/lib/dashboard/types.ts`:
  - Bỏ `roomCode?: string` và `receiptId?: string` khỏi `LearnerBookingView` interface (nếu có) — verify trước khi sửa.
- `apps/web/src/components/dashboard/SessionCard.tsx`:
  - **UpcomingCard (~line 175-193):** block render `booking.roomCode` (room pill + "Sao chép" button) → xoá toàn bộ block.
  - **LiveCard (~line 762-781):** block render `booking.roomCode` ("Mã phòng:" + copy) → xoá toàn bộ block.
  - **CompletedCard (~line 281-292):** Receipt button — chỉ render button "Biên lai" disabled với text "Chưa có biên lai" nếu `booking.receiptId` là undefined; không build placeholder text khác. i18n key mới: `Dashboard.card.receiptUnavailable`.
- `apps/web/src/messages/vi.json` + `en.json`:
  - Thêm `Dashboard.card.receiptUnavailable`: vi "Biên lai chưa có sẵn", en "Receipt not available yet".
  - Thêm `Dashboard.card.roomUnavailable`: vi "Mã phòng sẽ cấp khi mở phòng học", en "Room code will be issued when the room opens".
  - **Optional:** thêm `Dashboard.card.openRoom`: vi "Mở phòng học", en "Open room". Nếu thêm, sẽ render 1 link tới `/[locale]/bookings/{booking.id}/live` cho `LiveCard`/`UpcomingCard` khi `roomAccessEligible` (đã có) — đây là cách người dùng mở phòng thật, không phải mock.
- `apps/web/src/components/dashboard/DashboardShell.tsx`:
  - Không sửa, trừ khi cần truyền prop mới.

**Quy tắc:**
- **KHÔNG** build placeholder room/receipt mới. Nếu chưa có dữ liệu thật → nói "chưa có".
- Live join path vẫn chạy vì `LiveClassroomContent` đã mint room qua `room-access`.
- Phase 2 không tự thêm "Open room" link trừ khi đã chốt với user. (Đã chốt xoá hoàn toàn — không build replacement.) → bỏ option `Dashboard.card.openRoom` khỏi plan. vẫn giữ room-unavailable text để explain.

**Tests:**
- Cập nhật `apps/web/src/lib/dashboard/api-my-bookings.spec.ts` (nếu có) — assert `mapContractBookingToView` không trả về `roomCode`/`receiptId`.
- Cập nhật vitest của `SessionCard.tsx` (nếu có) — assert không còn element render "Mã phòng:" + "Biên lai #...".

**Acceptance:**
1. Dashboard load learner bookings → không còn `ROOM-...` hoặc `REC-...` strings trong DOM.
2. Booking `state=in_progress` → LiveCard render "Mã phòng sẽ cấp khi mở phòng học" (text-only), link "Vào phòng học" vẫn đi tới `/bookings/{id}/live`.
3. Booking `state=upcoming` → UpcomingCard render "Mã phòng sẽ cấp khi mở phòng học" (text-only) — không có input "copy code".
4. Booking `state=completed` → CompletedCard Receipt button render "Chưa có biên lai" với `aria-disabled="true"`.

---

### Phase 3 — FR-014 withdrawal honesty (UI-only, blocked)

**Commit:** `fix(web): mark withdrawal as not yet available (FR-014 backend gap)`

**Touch list:**
- `apps/web/src/app/[locale]/wallet/withdrawal/page.tsx`:
  - **KHÔNG xoá page** — đây vẫn là một route khả thi cho FR-014 khi backend có endpoint. Nhưng disable toàn bộ form nhập liệu.
  - Thay nút "Xác nhận Yêu cầu Rút {amount} VNĐ" (line ~295) bằng nút `disabled` với text từ i18n key mới `Wallet.withdrawal.unavailableCta`.
  - Inputs (`creditAmount`, quick-amount buttons): giữ nguyên để người dùng vẫn xem được số dư — KHÔNG disable inputs (còn làm UX tốt cho future). Tuy nhiên, button submit phải disabled để no-op.
  - State hiện tại (`amount`, `balance`) vẫn chạy như hiện tại — chỉ thay 1 element 1 banner ở cuối form.
  - Thêm banner cảnh báo đầu trang: "Tính năng rút tiền chưa khả dụng — backend chưa có endpoint (FR-014). Sẽ được triển khai trong release tới." — text từ i18n key mới `Wallet.withdrawal.unavailableNotice`.
  - **KHÔNG** thêm bất kỳ POST/handler nào — không gọi `callApi('/wallet/withdrawals')` (endpoint không tồn tại → sẽ 404, mất uy tín UX).
- `apps/web/src/messages/vi.json` + `en.json`:
  - Thêm nhóm `Wallet.withdrawal`:
    - `unavailableNotice`: vi "Tính năng rút tiền chưa khả dụng", en "Withdrawal is not available yet"
    - `unavailableBody`: vi "Hệ thống đang hoàn thiện quy trình rút tiền qua cổng payout. Vui lòng quay lại sau khi backend phát hành tính năng này (theo FR-014).", en "We are finishing the payout gateway integration. Please come back after the backend ships this feature (FR-014)."
    - `unavailableCta`: vi "Chưa khả dụng", en "Not yet available"

**Quy tắc:**
- **KHÔNG** build mock POST. **KHÔNG** build fake success UI.
- Banner giải thích rõ "backend chưa có endpoint" — minh bạch, không lừa người dùng.
- vn/en riêng. Status pill (nếu có) = text + colour.

**Tests:**
- Vitest cho page (nếu có): assert button submit có `disabled` và i18n key `unavailableCta`.
- Không cần test backend integration — không có integration.

**Acceptance:**
1. Truy cập `/[locale]/wallet/withdrawal` (signed in) → page load vẫn gọi `GET /wallet/balance` + `GET /auth/me` (không đổi).
2. Submit button render disabled với text "Chưa khả dụng" / "Not yet available".
3. Banner cảnh báo ở đầu trang nói rõ "FR-014 backend chưa có".
4. Không có network call `POST /wallet/withdrawals`.

---

### Phase 4 — Coverage update + verification

**Commit:** `docs(web): task03 coverage update`

**Touch list:**
- `SkillSwap-WEB-FE-API-Mapping.md` §3:
  - Row cho `POST /api/verifiers/{accountId}/status` → từ ❌ → ✅ (action-by-id only).
  - Note `roomCode` + `receiptId` removal.
  - Note FR-014 honesty (no backend endpoint).
- `SkillSwap-WEB-FE-API-Mapping.md` §4 — update gap #4 (admin control) và #5 (FR-014 honesty).
- `docs/plans/2026-10-14-task03-web-booking-reads-plan.md` (file này) — thêm status note cuối file (Phase 1/2/3 merged ngày nào, branch, gate xanh).

**Verification (gate):**
- `pnpm lint` — không cảnh báo mới (`--max-warnings=0`).
- `pnpm typecheck` — pass.
- `pnpm build` — pass.
- `pnpm test` — vitest pass (đặc biệt `SessionCard`/`api-my-bookings` specs).
- `pnpm test:arch` — không vi phạm dependency-cruiser (đã chứng minh Phase 0-3 không thêm domain layer).
- `pnpm verify` — green tổng.

---

## 4. Hard rule recap (từ AGENTS.md)

1. **Plan before code:** phase này (file này) đã land 1 commit riêng trước khi code.
2. **Money integer:** Phase 3 không động về tiền thật — chỉ disable UI. Phase 2 cũng không động. Phase 1 không động về tiền.
3. **Server truth only:** Phase 2 xoá fake `roomCode`/`receiptId` (đã fake là tội server-truth). Phase 3 xoá fake submit handler (đã fake là tội server-truth).
4. **Never auto-replay a POST:** `callApi` retry-once-on-401 (đã có sẵn); `setVerifierStatus` chỉ POST 1 lần, không auto-retry sau mutation.
5. **Design from `DESIGN.md`:** status = text + colour; vn/en riêng; mobile-first 360px; touch targets ≥44px.
6. **No mocked fallbacks:** Phase 2 + 3 chính là sửa mocked fallbacks. Phase 1 không thêm mock.
7. **Architecture:** Web chỉ dùng gateway + callApi; không bypass tới fetch. Không thêm `apps/api` code trong task này (nếu cần sửa backend → tạo ADR + backend task riêng).
8. **Commits:** `feat(web): ...`, `fix(web): ...`, `docs(web): ...` — `subject ≤ 72 chars`, body explains why. Sẽ không push.

---

## 5. Definition of done (mapped từ TASK-03 §7)

- [x] Phase 0 plan landed (`3bec7ee`).
- [x] `POST /verifiers/{accountId}/status` reachable từ admin control (action-by-id + deep link, lý do + limitation đã record). Route: `/[locale]/admin/verifiers/[accountId]` (`d2760d0`).
- [x] Không còn `roomCode`/`receiptId` fabricated trên dashboard; live join vẫn chạy end-to-end qua `/bookings/[id]/live` (`1b04752`).
- [x] Withdrawal screen không còn imply working flow; banner giải thích backend gap (`7f5b399`).
- [x] `tasks/taskbyrole/TASKS-INDEX.md` §2 rows #8, #10, #11 → ✅ (record ở đây vì `SkillSwap-WEB-FE-API-Mapping.md` tham chiếu trong index không tồn tại trong repo — không tự tạo file mapping mới theo AGENTS.md).
- [ ] `pnpm verify` xanh tổng thể (sẽ chạy cuối).
- [x] Không mock data, không compute status local, không replay POST (TASK-03 không touch POST/auto-replay).
- [x] Commits theo `type(scope): msg`, một cho mỗi phase: `3bec7ee` (docs), `d2760d0` (feat), `1b04752` (fix), `7f5b399` (fix).

---

## 6. Out of scope (chốt)

- FR-014 backend (no endpoint) — đợi backend task riêng (OQ-005/011 + ADR mới cho payout gateway).
- Verifier queue/claim/decision UI — đó là TASK-01 của Long.
- Mobile no-show button — đó là TASK-02 của Nhật Anh.
- Mobile `GET /classes/{id}` — đó là TASK-04 của Vũ Hưng.
- Sửa `BookClassUseCase`/`ClassesController.noShow` (D3/D4 trong báo cáo đánh giá) — backend task riêng.
- ADR-032 booking settlement amendment — backend task riêng.
- Per-criterion rating persistence — task khác.

---

## 7. Risks & open questions

| Risk | Mitigation |
|---|---|
| Long chưa tạo `http-gateway.ts` khi tôi vào Phase 1 | Tạo file tối thiểu với chỉ `setVerifierStatus` (theo xác nhận Q3); ghi comment "added by TASK-03; Long please append other methods". Commit Phase 1 không block Long. |
| Long đã viết `http-gateway.ts` với class `HttpVerificationGateway` khác pattern (không phải function-style) | Append method `setVerifierStatus` cuối class; giữ nguyên pattern của Long. |
| Phase 2 phá UI người dùng đang dựa vào `roomCode` để vào phòng (copy-paste) | Live flow vẫn qua `/bookings/{id}/live` (đã mint room thật). Verified lại bằng manual click trên booking in_progress. |
| Banner Phase 3 nói "backend chưa" khi user không quen sẽ gây nhầm lẫn | Banner text 2-dòng: tiêu đề ngắn + body chi tiết về release. EN/VN viết riêng. |
| `meResponse.role` chưa được khoá cứng trong `UserProfile` (`apps/web/src/lib/api-client.ts:21` hiện là `role?: string`) | Refactor sang `role?: AccountRole` trong Phase 1; re-export từ `@skillswap/contracts`. Type tightening, no runtime change. |

---

## 8. Suggested order

1. **Phase 0 (file này)** — commit plan trước.
2. **Phase 2** trước (xoá fake) — nhanh nhất, không phụ thuộc, an toàn nhất.
3. **Phase 3** (FR-014 honesty) — chỉ thay text + 1 banner.
4. **Phase 1** (admin control) — phụ thuộc vào việc Long có publish `http-gateway.ts` chưa; nếu chưa có → tự tạo skeleton.
5. **Phase 4** — coverage update + verify gate.

Total ước tính: 4 commits, ~1 ngày làm việc (Phase 0 + 4 verify + các commit).