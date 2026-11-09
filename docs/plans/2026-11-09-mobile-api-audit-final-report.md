# Mobile API Audit Final Report

> Phase 6 — Final Audit. Nguồn điều phối: [2026-11-09-mobile-api-audit-master-plan.md](./2026-11-09-mobile-api-audit-master-plan.md).
> Ngày: 2026-11-09 · Nhánh: `feature/mobile-api-audit` · HEAD: `16ba1aa` (`Feat/cloudinary and jaas (#101)`) · `HEAD..origin/main`: rỗng (đã `git fetch origin`).

## Executive Summary

Audit đồng bộ Mobile với backend đã ship (MM1–MM14) đã hoàn tất **chỉ trong `apps/mobile/**`**; backend, web và contracts không bị chạm.

- **Code đã đổi (7 hạng mục):** bỏ nút/route *Complete* (MM1), thêm reason `learner_not_verified` (MM1), heading lớp lấy từ `title` (MM10), copy thông báo của server + mark-read/mark-all-read (MM11, MM4), nộp certificate evidence (MM5), hiển thị hồ sơ đang nộp (MM6), validate ô `startsAt` (MM13).
- **Chỉ xác nhận, không đổi code:** MM2, MM3, MM7 (Option A), MM8; **MM12 chỉ audit** (không xoá file nào).
- **MM9 là Human Task** — Pending physical-device verification, không đánh dấu Complete.
- **MM14:** mỗi màn hình có thay đổi hành vi đều có spec; không mở rộng sang module khác.
- **Gate:** `typecheck`, `test`, `test:arch`, `lint`, `verify` đều PASS. **`test:e2e` = Not Executed** (môi trường: thiếu khóa JaaS cục bộ, Docker/postgres/rabbitmq không chạy — không liên quan thay đổi mobile).
- **Một ngoại lệ so với recount của plan:** `ClassDetail.title` còn 1 tham chiếu (fallback có chủ đích, xem *Regression Verification*).
- **Ready For Commit: YES.**

## Scope Verification

| Kiểm tra | Kết quả |
|---|---|
| `git diff --name-only` | 21 file, **tất cả** thuộc `apps/mobile/**` |
| `git diff --name-only --cached` | rỗng (chưa stage gì) |
| File chưa track trong `apps/mobile/**` | 9 (đều là code/test mới của audit) |
| Scope guard: file ngoài `apps/mobile/**` và `docs/plans/**` bị sửa | **rỗng** |
| `git diff --stat -- apps/api apps/web packages/contracts pnpm-lock.yaml package.json turbo.json .github apps/mobile/package.json` | **rỗng** |
| `git status -s` trong `apps/api apps/web apps/gateway packages pnpm-lock.yaml package.json turbo.json .github` (kể cả sau khi chạy `build`/`typecheck`/`verify`) | **rỗng** |
| Dependency mới | không (`apps/mobile/package.json` không đổi) |
| Route (`git ls-files apps/mobile/app`) | 20 file, không route mới, không route bị xoá/đổi tên |
| Untracked ngoài audit (không được `git add`) | `.vscode/`, `folder-structure.txt` |

Contracts chỉ được **đọc** (import schema có sẵn: `markNotificationsReadResponseSchema`, `evidenceDocumentUploadRequestSchema`, `evidenceDocumentUploadTargetSchema`, `createClassSchema`). `packages/contracts/dist` (gitignored) được build lại bởi `pnpm typecheck`/`verify`, không phải thay đổi source.

## Files Changed

**Tracked, đã sửa — 21 file (+411 / −33):**

| File | Thay đổi | MM |
|---|---|---|
| `app/(features)/teaching/[id].tsx` | xoá nút + handler Complete | MM1 |
| `src/infrastructure/http/teaching-gateway.ts` (+spec) | xoá `complete()`; spec không còn ghim route | MM1 |
| `src/infrastructure/http/api-evidence.ts` (+spec) | bỏ `complete`; thêm `/notifications/read-all`, `/notifications/:id/read`, `/skill-evidence/documents` | MM1, MM4, MM5 |
| `src/domain/booking/booking.ts` | thêm `learner_not_verified` | MM1 |
| `src/ui/class-detail-coordinator.ts` (+spec) | đọc `errorDetails.code` làm reason | MM1 |
| `src/ui/class-detail-view.tsx` | map `learner_not_verified`; heading = `title`; bỏ `title` lặp dưới nhãn Description | MM1, MM10 |
| `src/ui/teaching-class-detail.spec.tsx` | bỏ mock `complete`; test không có nút Complete, vẫn có save/cancel/start | MM1 |
| `app/(features)/notifications.tsx` | copy server + fallback; mark-read khi tap; nút mark-all | MM11, MM4 |
| `src/infrastructure/http/notification-gateway.ts` (+spec) | `markRead`, `markAllRead` | MM4 |
| `app/(features)/skills.tsx` | chọn loại evidence, chọn file certificate, history hiện loại | MM5 |
| `src/infrastructure/http/skill-evidence-gateway.ts` (+spec) | `requestDocumentUpload`, `submitCertificateEvidence` | MM5 |
| `src/infrastructure/http/student-verification-gateway.ts` | nới kiểu tham số `uploadDocument` (type-only) | MM5 |
| `app/(features)/verification.tsx` | khối "Current submission" | MM6 |
| `app/(features)/teaching.tsx` | gọi `parseStartsAt` trước khi tạo lớp | MM13 |
| `src/i18n/en.json`, `vi.json` | +15 key mới mỗi file, không sửa/xoá dòng nào | MM1, MM4, MM5, MM6, MM13 |

**Untracked, mới — 9 file trong `apps/mobile/src`:**
`domain/booking/booking.spec.ts`, `ui/class-detail-view.spec.tsx`, `ui/notification-copy.ts`, `ui/notifications-screen.spec.tsx`, `ui/skills-screen.spec.tsx`, `ui/teaching-form.ts`, `ui/teaching-form.spec.ts`, `ui/teaching-screen.spec.tsx`, `ui/verification-screen.spec.tsx`.

**Docs:** `docs/plans/2026-11-09-mobile-api-audit-master-plan.md` (untracked, đã append Phase 1–6) và file báo cáo này.

## MM Status Matrix

| MM | Loại | Trạng thái | Bằng chứng / ghi chú |
|---|---|---|---|
| MM1 | Code | **Complete** | `complete` = 0 ở `teaching-gateway.ts`; `class-1/complete` = 0; allowlist chỉ `cancel\|start`; danh sách reason mobile = backend (`booking.ts:30-39`) **8/8 đúng thứ tự**; mỗi reason có thông điệp en/vi (test); start/cancel/edit không đổi |
| MM2 | Verify | **Complete** (no change) | `marketplace-card.tsx:102` (`item.title`), `my-bookings-view.tsx:468` (`classSummary.title`) |
| MM3 | Verify | **Complete** (no change) | `class-detail-view.tsx:545-549`: "no reviews" chỉ khi `recentRatings` rỗng; có test render rating từ server |
| MM4 | Code | **Complete** | `markRead`/`markAllRead` parse schema có sẵn; tap không bị chặn khi lỗi; unread lấy từ response; 9 test màn hình + 3 test gateway |
| MM5 | Code | **Complete** | chọn `verifier_assessment`/`certificate`; upload qua flow Student Verification; submit `documentRef = objectKey`; payload `verifier_assessment` không đổi; history hiện loại. Chưa có nút xem lại certificate (không thuộc yêu cầu) |
| MM6 | Code | **Complete** (có giới hạn R-17) | hiển thị hồ sơ đang nộp khi có `documentId`, ẩn khi không có. **Không có nút tải**: backend chặn role `user` (R-17) |
| MM7 | Quyết định | **Complete** (Option A, không đổi code) | không có diff ở `marketplace-view.tsx`/`class-read-gateway.ts`; gap ghi R-04, R-07 |
| MM8 | Tài liệu | **Complete** (verify only) | không có `@Patch`/`@Put` ở `account-profile`; `profile-view.tsx` không đổi, 5 link + đổi ngôn ngữ còn nguyên; gap ghi R-08 |
| MM9 | Con người | **Human Task — Pending physical-device verification** | cần thiết bị Android/iOS thật + dev client; `tasks/todo.md` còn T02, T03 chưa tick; **không** đánh dấu Complete (R-09) |
| MM10 | Code | **Complete** (1 ngoại lệ recount) | heading = `detail.title`; khối Description chỉ còn `detail.description`; còn 1 tham chiếu `ClassDetail.title` là fallback khi `title` rỗng/toàn khoảng trắng |
| MM11 | Code | **Complete** | `Notifications.body_` = 0 ở `apps/mobile/app`; fallback nằm ở `src/ui/notification-copy.ts`; raw key không bao giờ hiển thị |
| MM12 | Audit only | **Complete** (audit-only; dọn dẹp hoãn → R-18) | 4 module definitely dead, 3 maybe dead; **không xoá/đổi tên/di chuyển file nào** |
| MM13 | Code | **Complete** | `parseStartsAt()`: rỗng / ISO sai / ngày không tồn tại / quá khứ; payload hợp lệ không đổi; không picker, không dependency |
| MM14 | Test | **Complete** (đúng phạm vi) | spec cho `notifications`, `skills`, `teaching` (form), `verification`, `class-detail-view`, `booking`; không thêm test cho MM7/MM8/MM12 |

## Regression Verification

**Recount (§13 của plan), chạy lại ở Phase 6:**

| Claim | Lệnh | Mong đợi | Thực tế | |
|---|---|---|---|---|
| Complete biến mất | `git grep -n "complete" -- apps/mobile/src/infrastructure/http/teaching-gateway.ts` | 0 | **0** | OK |
| Spec không còn ghim route | `git grep -n "class-1/complete" -- apps/mobile/src` | 0 | **0** | OK |
| Heading từ title | `git grep -n "ClassDetail.title" -- apps/mobile/src/ui/class-detail-view.tsx` | 0 | **1** (`:315`) | **Ngoại lệ có chủ đích** |
| Copy từ server | `git grep -n "Notifications.body_" -- apps/mobile/app` | 0 | **0** | OK |
| Reason đầy đủ | `git grep -n "learner_not_verified" -- apps/mobile/src` | ≥ 1 | **7** | OK |
| Mark-read có | `git grep -n "markRead" -- apps/mobile/src` | ≥ 1 | **4** | OK |
| Verifier queue nguyên vẹn | `git grep -n "documentRef" -- apps/mobile/src/ui/verifier-queue-view.tsx` | 4 / không đổi | **4** (HEAD cũng 4) | OK |
| Backend nguyên vẹn | `git diff --stat -- apps/api apps/web packages/contracts` | rỗng | **rỗng** | OK |

**Giải thích ngoại lệ `ClassDetail.title` = 1:** Phase 2 yêu cầu heading ưu tiên `detail.title` và đưa ví dụ `detail.title?.trim() ? detail.title : t('ClassDetail.title')`; code đúng như vậy và đã được báo cáo kèm kết quả grep ở Phase 2 (bạn tiếp tục sang Phase 3, không phản đối). Fallback chỉ chạy khi `title` rỗng hoặc toàn khoảng trắng (contract bắt `min(1)` và server trim nên thực tế hầu như không xảy ra), nhằm tránh heading trống. Mong đợi `0` trong plan gốc giả định không có fallback. Nếu muốn khớp `0` tuyệt đối: xoá nhánh fallback (1 dòng) và test "falls back to ClassDetail.title" tương ứng — chưa làm vì ngoài phạm vi "chỉ sửa khi có regression".

**Hành vi không được đổi (§13):**

| Hạng mục | Bằng chứng | |
|---|---|---|
| `Linking.openURL` + poll wallet 120 s, không nhúng Jitsi | `wallet-view.tsx:27-28` (`POLL_INTERVAL_MS=3_000`, `POLL_TIMEOUT_MS=120_000`), `:182`; không có diff ở file; không có import jitsi/webview | OK |
| Không chat/Admin/Withdrawal/MFA trên mobile | 20 route, không file nào khớp `chat\|admin\|withdraw\|mfa` | OK |
| `marketplace-view.tsx`: `nextCursor` + dedupe theo `id` | không có diff | OK |
| `verifier-queue-view.tsx` không có diff | `git diff` rỗng | OK |
| `availableSeats` (M24) | `class-detail-view.tsx:256,377`, `marketplace-card.tsx` | OK |
| Thời gian theo locale (M19) | `toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')` còn nguyên, kể cả chỗ mới | OK |
| 5 tab + 5 link feature, không đổi navigation | không có diff ở `app/(tabs)`, `app/_layout.tsx`, `(features)/_layout.tsx`, `profile-view.tsx` | OK |
| Session: SecureStore, single-flight refresh, 401 → login | không có diff ở `session-service.ts`, `infrastructure/auth`, `infrastructure/storage`, `gateway-client.ts` | OK |
| Tiền là số nguyên, không float | không có `parseFloat`/`toFixed` trong dòng thêm | OK |
| `messages-parity.spec.ts` xanh | nằm trong 42/42 suite mobile PASS | OK |

## Protected Areas Verification

`git diff` rỗng ở tất cả:

| Khu vực bảo vệ | Kết quả |
|---|---|
| `apps/mobile/src/ui/verifier-queue-view.tsx` | không đổi |
| `apps/mobile/src/infrastructure/push/**` (gồm `notification-target.ts`, `notification-device-lifecycle.ts`) | không đổi |
| Marketplace pagination (`marketplace-view.tsx`, `marketplace-card.tsx`, `class-read-gateway.ts`) — `nextCursor`, dedupe theo `id` | không đổi |
| Wallet polling flow (`wallet-view.tsx`, `wallet-service.ts`, `app/(tabs)/wallet.tsx`) | không đổi |
| `profile-view.tsx` | không đổi |

## I18N Verification

Kiểm tra bằng script so với `HEAD` (đọc cấu trúc JSON và quét key trùng trong từng object):

| | `en.json` | `vi.json` |
|---|---|---|
| Số key ở HEAD | 388 | 388 |
| Số key hiện tại | 403 | 403 |
| Key thêm mới | **15** | **15** |
| Key bị xoá / bị đổi nội dung | 0 / 0 | 0 / 0 |
| Dòng bị xoá trong `git diff` | 0 (chỉ `+13` dòng/file) | 0 |

- Hai bộ key mới **giống hệt nhau** giữa en và vi; thiếu ở vi: 0; thiếu ở en: 0. `messages-parity.spec.ts` PASS.
- 15 key mới: `Booking.error.learner_not_verified`, `ClassDetail.errorLearnerNotVerified`, `Notifications.markAllRead`, `Notifications.markAllReadError`, `Notifications.markReadError`, `Skills.chooseCertificate`, `Skills.evidenceType`, `Skills.type_certificate`, `Skills.type_verifier_assessment`, `Teaching.startsAtEmpty`, `Teaching.startsAtInvalid`, `Teaching.startsAtPast`, `Verification.currentSubmission`, `Verification.documentSubmitted`, `Verification.submittedAt`.
- **Key trùng:** chỉ có `Wallet.statusReversed` (hai lần, dòng 105 và 115 ở HEAD, ở **cả hai** file). Đây là lỗi **có sẵn từ HEAD**, không nằm trong diff của audit, thuộc khu vực Wallet (bảo vệ) nên **không sửa**. Audit không tạo key trùng nào.
- Thông điệp `learner_not_verified` đúng nguyên văn yêu cầu (en/vi). Key `Teaching.complete` không còn tham chiếu nhưng được giữ do ràng buộc "chỉ thêm key".

## Typecheck Result

`pnpm typecheck` (build contracts + `pnpm -r typecheck`) → **PASS** (exit 0): gateway, contracts, mobile, web, api.

## Test Result

`pnpm test` (`pnpm -r --workspace-concurrency=1 test`) → **PASS** (exit 0), 5 workspace:

| Workspace | Kết quả |
|---|---|
| `apps/mobile` (jest) | **42/42 suite, 324/324 test** |
| `apps/web` (vitest) | 57/57 file, 446/446 test |
| contracts + gateway + api (jest) | 4/4 · 12/12 · 165/165 suite — 37 · 251 · 1159 test |

Có log `console.error`/`ECONNREFUSED :4001` trong output nhưng đó là thông điệp của các test cố ý giả lập upstream không với tới; không có test nào fail.

## Architecture Result

`pnpm test:arch` → **PASS**: "no dependency violations found" (1046 modules, 3047 dependencies cruised).

## Lint Result

`pnpm lint` (`eslint . --max-warnings=0`) → **PASS** (exit 0, 0 warning).

## Verify Result

`pnpm verify` (lint → build → typecheck → test → test:arch) → **PASS** (exit 0). Sau khi chạy, `git status` ở `apps/api`, `apps/web`, `apps/gateway`, `packages`, `pnpm-lock.yaml`, `package.json`, `turbo.json`, `.github` vẫn rỗng.

## E2E Result

`pnpm test:e2e` (e2e của `@skillswap/api`) → **Not Executed (lỗi môi trường)**.

- Kết quả thô: exit 1 — 18 suite fail, 1 skipped; 80 test fail; **cả 80 đều cùng một nguyên nhân**: `JaaS private key not readable at …\.secrets\jaas-private.pem — run "pnpm keys:gen"`. Thêm 2 lỗi phụ `Cannot read properties of undefined (reading 'close')` ở bước teardown do app không khởi tạo được.
- Môi trường: thư mục `.secrets` có nhưng **không có** `jaas-private.pem`; Docker daemon không chạy (`docker info` lỗi pipe `dockerDesktopLinuxEngine`); `localhost:5432` (postgres) và `localhost:5672` (rabbitmq) không lắng nghe. Mức độ ảnh hưởng của mobile: **không** — e2e chỉ chạy `apps/api`, và diff không chạm `apps/api`/`packages/contracts`.
- Quyết định: **không** chạy `pnpm keys:gen` (có thể ghi đè khóa dev cục bộ) và không khởi động Docker; không sửa backend. Theo R-11, ghi **Not Executed**, không ghi PASS.
- Để chạy được: `pnpm keys:gen` (nếu chưa có khóa), `pnpm db:up`, `pnpm db:migrate`, rồi `pnpm test:e2e`.

## Open Risks

| ID | Description | Impact | Recommendation | Status |
|---|---|---|---|---|
| **R-04** | Contract list `GET /classes` không có query `format`/`level`/`school`/`verified` (đó là field của response B2–B4) | Mobile không lọc server-side được theo các tiêu chí đó; không lọc client-side trên dữ liệu phân trang vì sẽ sai kết quả | Cần backend task mở query tương ứng; sau đó mobile thêm filter | **Open** — ngoài khoá |
| **R-07** | MM7 chốt Option A (không thêm filter/UI); web và mobile vẫn lệch khả năng lọc. Server còn hỗ trợ `startDate`/`endDate`/`state` mà mobile không dùng | Trải nghiệm tìm lớp trên mobile hẹp hơn web | Giữ nguyên; nếu user duyệt, chọn B (khung thời gian qua `startDate`/`endDate`) hoặc C (hiển thị `level`/`format`/`verified`/`schoolName` ở card) ở task riêng | **Accepted** (Option A) |
| **R-08** | Backend không có route cập nhật profile (`@Patch`/`@Put` ở `account-profile`: 0) | Profile mobile chỉ đọc; không sửa được tên/email | Cần backend thêm route nếu muốn; mobile không tạo nút/màn giả | **Open** — scope gap theo audit §5 |
| **R-11** | Không có E2E mobile; `pnpm test:e2e` là e2e backend, cần Docker + khóa JaaS cục bộ | Chưa chứng minh bằng E2E rằng thay đổi mobile không phá contract đang chạy (gián tiếp: diff không chạm backend/contracts, `verify` xanh) | Chạy lại sau `pnpm keys:gen` + `pnpm db:up` + `pnpm db:migrate`; không ghi PASS khi chưa chạy | **Open** — Not Executed (môi trường) |
| **R-17** | `GET /student-verifications/:id/document` chỉ cho `admin`/`verifier` (`student-verification.controller.ts:164-166`) | Người học không thể mở lại tài liệu của chính mình; MM6 không có nút tải | Backend mở quyền owner như `GET /skill-evidence/:id/document`; sau đó mobile thêm nút mở (không log URL ký sẵn) | **Open** — backend |
| **R-18** | MM12: 4 module không còn importer nào (`ui/placeholder-view.tsx`, `ui/class-card.tsx`, `ui/hung/session.tsx`, `ui/hung/styles.ts`); chuỗi mock booking chỉ còn test dùng (`application/book-class-service.ts`, `infrastructure/mock/mock-booking-gateway.ts`, `infrastructure/mock/demo-class.ts`) | Tăng bề mặt bảo trì, gây nhiễu audit; không ảnh hưởng chạy | Task dọn dẹp riêng sau khi user duyệt: xoá 4 file chắc chắn dead; giữ chuỗi mock nếu muốn giữ test `BookingError` (lưu ý R-01: nhánh Vu Hung cũng sửa các file này) | **Open** — chưa xoá (audit only) |
| **R-19** | MM13: ô `startsAt` vẫn là `TextInput` (chỉ có validate, chưa có date/time picker); form sửa lớp `teaching/[id].tsx` dùng kiểm tra riêng (`Date.parse`) chứ chưa dùng `parseStartsAt` | Người dùng phải gõ ISO tay (đã có thông báo lỗi rõ); hai form kiểm tra không đồng nhất | Picker cần thêm dependency (bị khoá, R-10); đề xuất task riêng; có thể dùng `parseStartsAt` cho form sửa | **Open** |

**Ghi chú bổ sung (không thuộc danh sách trên):**

- **Process:** (a) `AGENTS.md` yêu cầu "mỗi phase một commit" nhưng chỉ thị audit là **1 commit cuối** (R-02) — theo chỉ thị mới nhất. (b) R-01: nhánh `origin/feat/vu-hung-mobile-completion` chạm tới 32 file mobile và **trùng 19** file với thay đổi này (so sánh hai đầu nhánh, có thể đếm dư) — merge nhánh nào sau sẽ conflict. (c) Nhánh `feature/mobile-api-audit` chưa có upstream; lần push đầu cần `git push -u origin feature/mobile-api-audit` (chờ user duyệt, R-03).
- **Dữ liệu có sẵn:** key trùng `Wallet.statusReversed` (xem *I18N Verification*) — ngoài phạm vi, không sửa.
- **Không thể kiểm chứng ở đây:** luồng upload thật tới Cloudinary/server thật, và response mark-read thật qua gateway; kiểm chứng bằng mock fetch + assertion signed field/contract.

## Commit Readiness

| Điều kiện | Kết quả |
|---|---|
| Typecheck | **PASS** |
| Test | **PASS** |
| Arch | **PASS** |
| Lint | **PASS** |
| Verify | **PASS** |
| E2E | Not Executed (môi trường, R-11) — plan cho phép ghi rõ lý do thay cho PASS |
| MM1–MM14 hoàn thành đúng kế hoạch | Có (MM6 giới hạn bởi R-17; MM10 có 1 ngoại lệ recount đã giải thích) |
| MM9 = Human Task | Có — Pending physical-device verification |
| Backend / Contracts / Web untouched | Có |
| Lockfile / `package.json` / dependency | Không đổi |
| Hook `githooks/commit-msg` | Đã bật (`core.hooksPath=githooks`) |
| `HEAD..origin/main` | Rỗng (sau `git fetch origin`) |

### **Ready For Commit: YES**

Cách tạo đúng 1 commit (không `git add -A`; không thêm `.vscode/`, `folder-structure.txt`):

```powershell
git add apps/mobile docs/plans/2026-11-09-mobile-api-audit-master-plan.md docs/plans/2026-11-09-mobile-api-audit-final-report.md
git status -s   # chỉ thấy apps/mobile + 2 file docs/plans; .vscode/ và folder-structure.txt vẫn untracked
git commit -m "fix(mobile): sync mobile flows with API audit" -m "<body bên dưới>"
```

Chưa commit/push trong Phase 6 (theo quy tắc "1 commit cuối, 1 push cuối" và chờ user duyệt).

## Recommended Commit Message

Subject (45 ký tự, đúng chuẩn hook):

```
fix(mobile): sync mobile flows with API audit
```

Body đề xuất (giải thích *why*, liệt kê MM):

```
Align the mobile client with backend behaviour that already shipped, without
touching apps/api, apps/web or packages/contracts.

- MM1: drop the Complete action (AC-035: completion is automatic) and add the
  learner_not_verified booking rejection with en/vi copy.
- MM10: class detail heading uses the class title; description no longer repeats it.
- MM11/MM4: show server-localized notification copy and mark notifications read
  (single and all), updating the unread count from the server response.
- MM5: certificate evidence reuses the student-verification upload flow and
  submits documentRef; history shows the evidence type.
- MM6: show the current verification submission when the server returns documentId.
- MM13: validate the publish start time (empty / invalid / past) before sending.
- MM14: tests for each changed screen and helper.
- MM2, MM3, MM7 (option A), MM8 verified with no change; MM12 audit only;
  MM9 remains a human task (physical-device push evidence).

```
