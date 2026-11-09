# Mobile API Audit Master Plan

> Tài liệu điều phối **duy nhất** cho Mobile Audit (MM1–MM14).
> Nguồn: `2026-11-07-mobile-flow-audit-and-api-sync` (PDF "mobile-sync-Long", Status: Proposed), đối chiếu code thực tế trên `main`.
> Trạng thái: **Plan — chưa sửa dòng code nào.**
# Critical Execution Rules

Mục tiêu của audit này:

- Đồng bộ Mobile với backend đã ship.
- Không phát triển backend mới.
- Không phát triển contract mới.
- Không redesign ứng dụng.
- Không refactor kiến trúc ngoài phạm vi audit.

Thứ tự ưu tiên:

1. API Sync
2. Bug Fix
3. Regression Prevention
4. Conflict Prevention

Không mở rộng phạm vi ngoài task hiện tại.

---

# UI Consistency Guardrails

Mọi thay đổi giao diện phải:

- tái sử dụng component hiện có
- tái sử dụng style hiện có
- tái sử dụng spacing hiện có
- tái sử dụng typography hiện có
- tái sử dụng color token hiện có
- tái sử dụng navigation hiện có

Không được:

- redesign màn hình
- đổi layout tổng thể
- đổi screen hierarchy
- đổi navigation
- đổi UX flow đang hoạt động
- thay đổi các screen không thuộc phạm vi task

Mục tiêu:

Fix và đồng bộ dữ liệu.

Không làm mới UI.

---

# No Scope Creep Rule

Chỉ thực hiện đúng phạm vi của phase hiện tại.

Ví dụ:

- MM1 không được chỉnh MM10
- MM10 không được chỉnh MM4
- MM4 không được chỉnh MM5
- MM5 không được chỉnh MM7

Nếu phát hiện vấn đề ngoài phạm vi:

- ghi vào Risk Register
- không sửa
- không mở rộng scope

---

# Protected Areas

Các khu vực sau đang hoạt động đúng và phải được bảo vệ.

## Verifier Queue

Không sửa:

apps/mobile/src/ui/verifier-queue-view.tsx

Trừ trường hợp:

- compile error
- typecheck error trực tiếp gây ra bởi phase hiện tại

Xác nhận cuối audit:

- documentRef vẫn hiển thị
- description vẫn hiển thị

## Marketplace Pagination

Không sửa logic:

- nextCursor
- dedupe theo id

Không được chuyển sang pagination client-side.

## Wallet Flow

Không thay đổi:

- top-up polling
- provider-ref polling
- transaction history flow

## Notification Routing

Không thay đổi:

apps/mobile/src/infrastructure/push/notification-target.ts

trừ khi task phase hiện tại yêu cầu trực tiếp.

---

# No Cleanup Rule

Không được:

- tự xóa file
- tự move file
- tự rename file
- tự tách module
- tự gộp module
- tự refactor kiến trúc

MM12 chỉ được:

- audit
- báo cáo

Không được xóa dead code nếu chưa có task riêng.

---

# Backend Escalation Rule

Nếu phát hiện:

- thiếu API
- thiếu field
- thiếu contract
- thiếu endpoint

Không được:

- sửa backend
- sửa contracts
- tạo API mới
- tạo schema mới
- tạo migration
- chỉnh sửa database

Thực hiện:

1. Ghi vào Risk Register
2. Đề xuất backend task
3. Dừng tại phần mobile

---

# Regression Policy

Sau mỗi phase phải xác minh:

- typecheck vẫn pass
- test cũ không fail
- flow cũ không mất chức năng
- route cũ không mất
- UI hiện có không bị thay đổi ngoài phạm vi

Nếu regression xảy ra:

- sửa regression trước
- chưa được đóng phase

---

# Backend Protection Check

Trước khi đóng bất kỳ phase nào:

Chạy:

git diff --name-only

Expected:

Chỉ xuất hiện:

apps/mobile/**

Nếu xuất hiện:

- apps/api/**
- apps/web/**
- packages/contracts/**
- pnpm-lock.yaml

STOP.

Không được đánh dấu phase hoàn thành.

---

# Phase Completion Policy

Một phase chỉ được đánh dấu Complete khi:

- Verification Gate pass
- Regression Check pass
- Backend Protection Check pass
- Typecheck pass
- Test pass (nếu có test liên quan)
- Progress Log đã được cập nhật

Nếu còn bất kỳ lỗi nào:

Status phải là:

In Progress

Không được chuyển thành Complete.

---

# Current Audit Decisions

## MM7

Đã chốt:

Option A

Không bổ sung filter mới.

Không thêm filter:

- format
- level
- school
- verified

Lý do:

Backend chưa hỗ trợ query tương ứng.

Chỉ audit parity gap.

---

## MM9

MM9 là Human Task.

Không phải coding task.

Không triển khai bằng code.

Không sửa application logic.

Không tạo screen mới.

Final Report chỉ ghi:

Pending physical-device verification.

---

## M6 Complete Action

Đã chốt:

DROP

Không:

- khôi phục route
- tạo API complete
- tạo workaround completion

Chỉ loại bỏ action khỏi mobile.

---

## Backend Features B1–B9

Đã xác minh trong Phase 0.

Status:

Supported

Nguyên tắc:

Mobile consume.

Không phát triển backend mới.

---

## Working Features To Protect

Các tính năng sau đang hoạt động tốt và phải được giữ nguyên:

- Verifier Queue documentRef rendering
- Marketplace nextCursor paging
- Marketplace dedupe by id
- Notification push routing
- Relative time localization
- Wallet polling workflow
- availableSeats rendering
- Profile feature navigation links

Không được làm suy giảm các tính năng này trong bất kỳ phase nào.
## Mục lục

1. [Repository State](#1-repository-state)
2. [Audit Context](#2-audit-context)
3. [Objective và Definition of Done](#3-objective-và-definition-of-done)
4. [Scope](#4-scope)
5. [Mobile Only Lock](#5-mobile-only-lock)
6. [Backend Protection Rules](#6-backend-protection-rules)
7. [UI Consistency Rules](#7-ui-consistency-rules)
8. [Git Safety Rules](#8-git-safety-rules)
9. [Capability Matrix B1–B9](#9-capability-matrix-b1b9)
10. [Phase Roadmap](#10-phase-roadmap)
11. [MM1–MM14 Breakdown](#11-mm1mm14-breakdown)
12. [Verification Gates](#12-verification-gates)
13. [Regression Checks](#13-regression-checks)
14. [Risk Register](#14-risk-register)
15. [Progress Log](#15-progress-log)
16. [Final Audit Checklist](#16-final-audit-checklist)

---

## 1. Repository State

- **Current Branch:** `main` (sạch, đồng bộ `origin/main`)
- **Current Commit:** `16ba1aa` — `Feat/cloudinary and jaas (#101)`
- **Created Date:** 2026-11-09
- **Untracked không thuộc plan:** `.vscode/`, `folder-structure.txt` (không `git add`)
- **Nhánh chưa merge liên quan:** `origin/feat/vu-hung-mobile-completion` (8 commit, 30 file trong `apps/mobile`) — xem R-01

Baseline recount trên `main` (2026-11-09):

| Claim | Kết quả |
|---|---|
| `complete` trong `teaching-gateway.ts` | `:22`, `:23` (MM1 còn nguyên) |
| `class-1/complete` trong `apps/mobile/src` | `teaching-gateway.spec.ts:41` (spec ghim lỗi) |
| `ClassDetail.title` trong `class-detail-view.tsx` | `:312` (MM10 còn nguyên) |
| `Notifications.body_` trong `apps/mobile/app` | `notifications.tsx:75` (MM11 còn nguyên) |
| `learner_not_verified` trong `apps/mobile/src` | 0 kết quả (thiếu reason, thuộc MM1) |
| `markRead` trong `apps/mobile/src` | 0 kết quả (MM4 còn nguyên) |
| `verifier_assessment` trong `apps/mobile/app` | `skills.tsx:38` (MM5 còn nguyên) |

Số dòng trong audit PDF vẫn khớp `main` — audit chưa stale ở các dòng này.

---

## 2. Audit Context

Audit hỏi hai câu: (1) mỗi màn hình có chạy không; (2) mỗi field có đến từ API không.

- 20 file `.tsx` trong `apps/mobile/app`: 4 layout, 2 redirect shell, 14 màn hình thật.
- 13 flow: 5 tốt, 6 degraded, 1 hard-broken (M6), 1 dead-end. Sau B1/B5/B6/B7: 7 tốt, 5 degraded, 1 hard-broken.
- 24 field: 5 cần backend đổi (3 đã ship), 0 field bị bịa. Mobile **hiển thị thiếu**, không bịa (ngược với web).

**Ba lỗi chính**

1. **Hard break (M6 → MM1):** nút *Complete* gọi `POST /classes/:id/complete`, route đã xoá 2026-10-25 (AC-035: tự hoàn thành theo `scheduled_end`/`room_idle`) → luôn 404.
2. **Heading vô nghĩa (M1 → MM10):** mọi class detail mở bằng "Class Details" dù đã có `title` (B1).
3. **Bỏ phí backend đã ship (M10/M16 → MM4, MM11):** inbox dùng map 6 key client, bỏ qua `title`/`body` server theo locale (B7); gateway chưa có mark-read (B6).

**Nhãn quyết định:** `ADD`, `DERIVE`, `READ`, `DROP`. Mobile chỉ có **một DROP**: nút Complete (một action, không phải field).

**Không phải defect (Audit §5) — KHÔNG đụng:** (1) không nhúng Jitsi — giữ `Linking.openURL` + poll wallet 120 s; (2) không chat; (3) không màn Admin; (4) không Withdrawal; (5) không MFA; (6) profile read-only (không có route update); (7) presence unknown khi thiếu `JITSI_WEBHOOK_SECRET`.

**Hành vi đã đúng cần giữ:** M2 phân trang `nextCursor` + dedupe theo `id` (`marketplace-view.tsx`); M9 `description` + `documentRef` ở `verifier-queue-view.tsx`; M19 relative time theo locale; M24 `availableSeats` thật.

**Đánh số — tránh nhầm:** `M*` là flow/field của audit; `MM*` là task mobile. **MM9 (task, việc con người: bằng chứng push thiết bị thật) ≠ M9 (verifier queue).** MM15 (accessibility rubric) là việc con người, ngoài phạm vi.

---

## 3. Objective và Definition of Done

**Objective:** đồng bộ Mobile với Backend đã ship, đóng các phần mobile làm được, **không đụng backend**.

- [ ] Typecheck PASS
- [ ] Test PASS
- [ ] Architecture PASS
- [ ] Verify PASS (`pnpm verify`)
- [ ] E2E PASS (`pnpm test:e2e`)
- [ ] Chỉ **1 commit** cuối
- [ ] Chỉ **1 lần push** cuối
- [ ] Scope guard sạch (chỉ `apps/mobile/**` + file master plan)

---

## 4. Scope

- **In scope:** MM1–MM8, MM10–MM14 (phần làm được trong `apps/mobile`); MM9 chỉ theo dõi.
- **Out of scope (chạm vào → ghi Risk Register):** mọi thay đổi `apps/api`, `apps/web`, `packages/contracts`; B10 (docs `complete` stale); route/DTO/migration/DB; MM9, MM15.

---

## 5. Mobile Only Lock

**Được phép sửa:** `apps/mobile/**`

**Cấm sửa:** `apps/api/**`, `apps/web/**`, `packages/contracts/**`, `pnpm-lock.yaml`, `package.json` (root), `turbo.json`, `.github/**`.

`apps/mobile/package.json` coi như **cấm** (đổi dependency kéo theo lockfile) → **không thêm thư viện**. Chỉ dùng dependency sẵn có (`expo-document-picker`, `expo-linking`, `expo-file-system`…).

**Không được:** sửa/tạo API backend, sửa DTO, sửa contracts, tạo migration, sửa database. Backend thiếu field/API → **chỉ ghi Risk Register**.

**MM9 Protection:** không sửa `apps/mobile/src/ui/verifier-queue-view.tsx` trừ khi lỗi compile bắt buộc (ghi lý do vào Progress Log).

**Scope guard** (kết quả phải rỗng):

```powershell
git diff --name-only | Select-String -NotMatch "^apps/mobile/|^docs/plans/2026-11-09-mobile-api-audit-master-plan.md$"
git diff --name-only --cached | Select-String -NotMatch "^apps/mobile/|^docs/plans/2026-11-09-mobile-api-audit-master-plan.md$"
```

---

## 6. Backend Protection Rules

1. Contracts **chỉ đọc**: mobile `import` từ `@skillswap/contracts` (đã có `markNotificationsReadResponseSchema`, `documentDownloadTargetSchema`, `notificationItemSchema`) nhưng không sửa package.
2. Không bịa field: response thiếu thì hiển thị trạng thái rỗng thật.
3. Không dựng route/stub giả phía mobile để che thiếu hụt backend.
4. Mỗi gap backend = một dòng Risk Register (mô tả, MM ảnh hưởng, đề xuất cho backend).
5. `pnpm test:e2e` (e2e của api) chỉ để **kiểm chứng**, không sửa test/fixture backend.
6. Route `complete` **không được thêm lại** ở bất kỳ lớp nào (AC-035: giáo viên không được kết thúc lớp sớm).

---

## 7. UI Consistency Rules

Tái sử dụng component (`AppButton`, `SurfaceCard`, `FeedbackBanner`, `StatusPill`, `ScreenScroll` trong `@/ui/primitives`), token (`@/design/tokens`: `colors`, `spacing`, `typography`), typography và spacing hiện có.

**Không:** redesign, đổi layout, đổi navigation, đổi UX hiện hữu.

- 360 px, không cuộn ngang; vi/en không trộn trên một màn; trạng thái luôn có text + màu (`DESIGN.md`).
- Chuỗi mới phải có **cả** `en.json` và `vi.json` (`messages-parity.spec.ts`).
- Chỉ thêm UI khi *bắt buộc* để đóng một MM (vd. nút "mark all read"); không đổi số tab/route/thứ tự điều hướng.

---

## 8. Git Safety Rules

- **Không commit giữa chừng, không push giữa chừng; chỉ 1 commit cuối, 1 push cuối.**
- Không `git add -A`/`.` — chỉ `git add apps/mobile docs/plans/2026-11-09-mobile-api-audit-master-plan.md`.
- Checkpoint **không commit** sau mỗi phase: `git diff > <scratch>/phase-N.patch` (ngoài repo).
- Trước push: `git fetch origin`, `git log HEAD..origin/main --oneline` phải rỗng (hoặc rebase rồi chạy lại gate).
- Message theo hook `githooks/commit-msg`: `type(scope): subject` ≤ 72 ký tự, vd. `fix(mobile): sync mobile with shipped backend (B1-B9)`; body giải thích *why*.
- Lệnh cần mạng (`git fetch`, `git push`) chạy riêng ngoài sandbox; không `--force`, không `--no-verify`.

---

## 9. Capability Matrix B1–B9

Đối chiếu read-only trên `main` @ `16ba1aa` (status ban đầu *Unknown* → đã xác nhận):

| ID | Capability | Bằng chứng | Backend | Consumer | Mobile hiện tại |
|---|---|---|---|---|---|
| B1 | `title` class | `mobile-classes.ts:196` | ✅ Shipped | MM2, MM10 | Card/booking row đọc; **detail heading chưa** |
| B2 | `level` (nullable) | `mobile-classes.ts:197-198` | ✅ Shipped | MM7 (tuỳ chọn) | Chưa hiển thị |
| B3 | `format` | `mobile-classes.ts:200` | ✅ Shipped | MM7 (tuỳ chọn) | Chưa hiển thị |
| B4 | `verified` + `schoolName` | `mobile-classes.ts:191-194` | ✅ Shipped | MM7 (tuỳ chọn) | Chưa hiển thị |
| B5 | `recentRatings` + aggregate | `mobile-class-detail.ts:64` | ✅ Shipped | MM3 (verify) | Đã render `:264-273`, `:541-552` |
| B6 | `POST /notifications/:id/read`, `/read-all` | `notifications.controller.ts:66,79` | ✅ Shipped | MM4 | Gateway chưa có hàm |
| B7 | Copy `title`/`body` theo locale | `notificationItemSchema`, entity locale | ✅ Shipped | MM11 | Màn hình bỏ qua |
| B8 | Student verification `documentId` + download | `verification.ts:63`, `controller:164` | ✅ Shipped | MM6 | Không hiện "đã nộp gì" |
| B9 | Certificate evidence + upload | `skill-evidence.controller.ts:85,141` | ✅ Shipped | MM5 | `skills.tsx:38` hardcode |

Phase 0 phải chạy lại từng dòng (§13) và sửa cột *Backend* nếu lệch — đó là cách audit cũ bị stale ở B5/B6/B7. B8/B9 cần đọc đủ shape (R-13).

---

## 10. Phase Roadmap

| Phase | Nội dung | Ghi chú |
|---|---|---|
| **0** | Audit Baseline | Recount §13; đọc shape B8/B9; chốt R-01/R-02/R-03/R-12 |
| **1** | MM1 | Hard break, độc lập |
| **2** | MM10 → MM2 → MM3 | MM10 sửa heading; MM2/MM3 verify-only |
| **3** | MM11 → MM4 | MM11 trước: language check của MM4 phụ thuộc MM11 |
| **4** | MM5 → MM6 | Chung luồng upload tài liệu |
| **5** | MM7, MM8, MM12, MM13, MM14 | MM14 (test) làm cuối để phủ MM4/5/6/11/13 |
| **6** | Final Audit | Verify, E2E, scope guard, 1 commit, 1 push |

Mỗi phase kết thúc: `typecheck` + `test` mobile + scope guard + Progress Log + patch checkpoint (không commit).

---

## 11. MM1–MM14 Breakdown

### MM1 — Gỡ nút Complete + reason còn thiếu (Phase 1)

- **Current State:** `teaching-gateway.ts:22-23` POST `/classes/:id/complete`; `teaching/[id].tsx:91` hiện nút khi `in_progress`; `teaching-gateway.spec.ts:32-41` assert route; `api-evidence.ts:35-36` allowlist `(cancel|start|complete)`; `booking.ts:14-22` có 7 reason, server (`booking.ts:30-39`) có 8 — thiếu `learner_not_verified`; i18n `error.*` (`en.json:16-22`) cũng thiếu.
- **Root Cause:** AC-035 xoá route 2026-10-25 (`classes.controller.ts:179-181`); web đã gỡ nút (`instructor/page.tsx:483`), mobile bị bỏ sót. Danh sách reason viết tay thay vì phản chiếu enum server.
- **Scope:** DROP action Complete ở mọi lớp (gateway, UI, spec, allowlist, i18n); thêm reason + thông điệp en/vi và nhánh hiển thị (Phase 0 xác định nơi: `class-detail-coordinator.ts:228-229`, `class-detail-view.tsx:145-167`).
- **Allowed Files:** `teaching-gateway.ts`(+spec), `api-evidence.ts`(+spec), `teaching/[id].tsx`, `teaching-class-detail.spec.tsx`, `domain/booking/booking.ts`, `i18n/en.json`+`vi.json`, và (nếu bắt buộc) `class-detail-coordinator.ts`/`class-detail-view.tsx` đúng nhánh switch.
- **Forbidden Files:** `apps/api/**` (không thêm lại route), `apps/web/**`, `packages/contracts/**`, `verifier-queue-view.tsx`, `marketplace-view.tsx`.
- **Tasks:** (1) xoá `complete` khỏi `TeachingGateway`; (2) xoá nút + handler, giữ start/cancel/edit; (3) sửa spec, thêm assert gateway không còn `complete`; (4) allowlist → `(cancel|start)`; (5) xoá `Teaching.complete` ở cả en/vi nếu hết tham chiếu; (6) thêm `learner_not_verified` + `error.learner_not_verified` + nhánh hiển thị; (7) diff hai danh sách reason (mobile vs `apps/api/.../booking.ts:30-39`) phải bằng nhau.
- **Verification:** recount `complete` = 0, `class-1/complete` = 0, `learner_not_verified` ≥ 1; typecheck + test PASS.
- **Regression Checks:** start/cancel/edit đúng route; `api-evidence` vẫn cho `cancel`/`start`; parity xanh; luồng book/hold/confirm không đổi.
- **Exit Criteria:** không còn tham chiếu `complete`; không reason server nào thiếu thông điệp; spec ghim lỗi đã bị loại.

### MM10 — Heading chi tiết lớp lấy từ `title` (Phase 2)

- **Current State:** `class-detail-view.tsx:312` render `t('ClassDetail.title')` ("Class Details"); `:334` nhãn `ClassDetail.description`, `:335` in `detail.title` dưới nhãn đó, `:336` mới là `detail.description`.
- **Root Cause:** trước B1 không có `title` nên heading tĩnh; B1 ship nhưng UI chưa nối lại, title bị đẩy xuống dưới nhãn "description" (audit M1/M4).
- **Scope:** chỉ đổi nguồn/chuỗi heading và nhãn mục, không đổi bố cục.
- **Allowed Files:** `class-detail-view.tsx`, `class-detail-styles.ts` (chỉ tái dùng style có sẵn), `i18n/en.json`+`vi.json`, spec liên quan.
- **Forbidden Files:** `class-detail-coordinator.ts` (logic booking), `verifier-queue-view.tsx`, mọi thứ ngoài `apps/mobile/**`.
- **Tasks:** (1) `:312` → `detail.title` (giữ `styles.title` + `StatusPill`); (2) bỏ dòng `:335` lặp hoặc đổi nhãn để không gắn "description" cho title; giữ `:336`; (3) xoá `ClassDetail.title` khỏi en/vi nếu hết tham chiếu; (4) test render heading = tiêu đề lớp.
- **Verification:** recount `ClassDetail.title` = 0; test xanh; kiểm tra thủ công ≥ 2 lớp khác tên (ghi Progress Log vì không có E2E UI).
- **Regression Checks:** hold/confirm/insufficient-balance/expired còn nguyên; `availableSeats` (M24); teacher card; title dài không tràn 360 px.
- **Exit Criteria:** heading khác nhau theo lớp; không còn nhãn "description" bọc title.

### MM2 — Title trên card và booking row (Phase 2, verify-only)

- **Current State:** audit: `marketplace-card.tsx:101-103`, `my-bookings-view.tsx:468,530` đã đọc `title` (B1 shipped).
- **Root Cause:** không có lỗi — mục "đã xong, cần xác nhận" (audit §7).
- **Scope:** xác nhận bằng grep + test; chỉ sửa nếu phát hiện hồi quy.
- **Allowed Files:** `marketplace-card.tsx`, `my-bookings-view.tsx`, spec tương ứng (chỉ khi có lỗi).
- **Forbidden Files:** `marketplace-view.tsx` (paging + dedupe khoá), mọi thứ ngoài `apps/mobile/**`.
- **Tasks:** (1) grep `title` ở hai view; (2) xác nhận contract `title: z.string().min(1)` nên không cần fallback; (3) chạy `my-bookings-*.spec.ts`, `class-read-gateway.spec.ts`; (4) lệch → sửa tối thiểu + test, không lệch → ghi "no change".
- **Verification:** test liên quan PASS; ghi `file:line` bằng chứng.
- **Regression Checks:** card không đổi chiều cao bất thường; dedupe theo `id` + `nextCursor` còn nguyên.
- **Exit Criteria:** có bằng chứng title hiển thị; không có diff thừa.

### MM3 — Rating read-back (Phase 2, verify-only)

- **Current State:** B5 shipped (`mobile-class-detail.ts:64`); mobile render ở `class-detail-view.tsx:264-273` (`noRatings` `:273`), `:541-552`, `marketplace-card.tsx:71-77`.
- **Root Cause:** trước B5 query server hardcode aggregate nên sau khi rate vẫn "No ratings yet"; gốc đã sửa phía server.
- **Scope:** verify only — **không xây read path mới** (audit M5/M7/M8).
- **Allowed Files:** `class-detail-view.tsx`, `marketplace-card.tsx`, `rating-gateway.ts`+spec (chỉ khi có lỗi).
- **Forbidden Files:** `apps/api/**` (không sửa `get-class-detail.query.ts`), `packages/contracts/**`.
- **Tasks:** (1) đọc `:260-275`, `:538-555`, xác nhận nhánh empty chỉ khi `recentRatings` rỗng thật; (2) chạy `rating-gateway.spec.ts` + coordinator spec; (3) thử thủ công với dữ liệu `pnpm db:demo` nếu có, nếu không ghi giới hạn; (4) gate `ratingEligible` ở `(tabs)/schedule` vẫn đúng.
- **Verification:** test PASS; `recentRatings` được tiêu thụ ở view.
- **Regression Checks:** submit rating còn chạy; không hiện rating giả; style không đổi.
- **Exit Criteria:** có bằng chứng file:line + test, hoặc lỗi đã sửa tối thiểu kèm test.

### MM11 — Dùng `title`/`body` do server trả (Phase 3)

- **Current State:** `notifications.tsx:74-75` render `t('Notifications.type_'+type)` / `t('Notifications.body_'+type)` từ map 6 key; bỏ qua `item.title`/`item.body` (contract `mobile-notifications.ts:7`, `min(1)`).
- **Root Cause:** trước B7 server chỉ trả tiếng Anh nên client tự dịch; B7 đã ship nhưng client chưa chuyển; event type mới sẽ hiện key thô.
- **Scope:** chỉ đổi nguồn text từng item; không đổi routing khi chạm, không đổi push lifecycle.
- **Allowed Files:** `app/(features)/notifications.tsx`, `i18n/en.json`+`vi.json`, test mới.
- **Forbidden Files:** `notification-target.ts`, `notification-device-lifecycle.ts`, mọi thứ ngoài `apps/mobile/**`.
- **Tasks:** (1) hiển thị `item.title`/`item.body`; (2) xoá `Notifications.type_*`/`body_*` ở cả en/vi chỉ khi hết tham chiếu; (3) giữ `createdAt` theo locale (M19); (4) test: type lạ hiển thị copy server, không key thô; (5) ghi R-05.
- **Verification:** recount `Notifications.body_` = 0; test PASS.
- **Regression Checks:** tap item điều hướng đúng; load-more/cursor; badge `unread`.
- **Exit Criteria:** mọi item hiển thị copy server; không còn khả năng hiện raw key.

### MM4 — Mark-read từ thiết bị (Phase 3)

- **Current State:** `notification-gateway.ts` chỉ có `list`, `registerDevice`, `removeDevice`; `markRead` recount = 0. Server (B6) trả `{ success: true, unreadCount }`.
- **Root Cause:** gateway viết trước B6; `read` có trong row nhưng không bao giờ bị đổi từ thiết bị nên badge không về 0.
- **Scope:** thêm 2 hàm gateway; gọi khi tap item và qua một nút "mark all read" (`AppButton tone="quiet"`).
- **Allowed Files:** `notification-gateway.ts`(+spec), `notifications.tsx`, `api-evidence.ts`(+spec) nếu allowlist cần path, `i18n/en.json`+`vi.json`.
- **Forbidden Files:** `apps/api/**`, `packages/contracts/**` (chỉ import schema có sẵn), `notification-target.ts`.
- **Tasks:** (1) `markRead(id)` → POST `/notifications/${encodeURIComponent(id)}/read`; (2) `markAllRead()` → POST `/notifications/read-all`; cả hai parse `markNotificationsReadResponseSchema`; (3) tap item gọi `markRead` (lỗi không chặn điều hướng), cập nhật `read` + `unread` từ response; (4) nút mark-all ẩn khi `unread === 0`, lỗi dùng `FeedbackBanner`; (5) kiểm tra allowlist `api-evidence.ts`, thiếu thì thêm đúng 2 path + test; (6) i18n en/vi; (7) spec gateway (URL, POST, parse, lỗi).
- **Verification:** recount `markRead` ≥ 1; spec xanh.
- **Regression Checks:** list/cursor, push enable/disable, 401 single-flight refresh, không double-submit khi `busy`.
- **Exit Criteria:** badge giảm khi đọc, mark-all về 0; language check đạt nhờ MM11.

### MM5 — Certificate evidence cho skill (Phase 4)

- **Current State:** `skills.tsx:38` hardcode `evidenceType: 'verifier_assessment'`; `skill-evidence-gateway.ts:20` ghi "không có upload endpoint" — lỗi thời vì B9 (`POST /skill-evidence/documents`, `GET /skill-evidence/:id/document`); `en.json:202` đã có `type_certificate`.
- **Root Cause:** gateway/UI viết trước B9; chỉ một loại evidence nên `documentRef` (`index.ts:502`) không bao giờ được set dù mobile là client duy nhất có file picker.
- **Scope:** chọn loại evidence; với `certificate`: chọn file → lấy upload target → PUT → submit kèm `documentRef`, tái dùng cơ chế của `verification.tsx`.
- **Allowed Files:** `skills.tsx`, `skill-evidence-gateway.ts`(+spec), helper upload hiện có trong `apps/mobile/src/infrastructure/**`, `api-evidence.ts`(+spec) nếu cần, `i18n/*.json`.
- **Forbidden Files:** `apps/api/**`, `packages/contracts/**`, `verifier-queue-view.tsx`, `package.json`.
- **Tasks:** (1) Phase 0 đọc `skill-evidence.ts` + `skill-evidence.controller.ts:61-175` chốt shape; (2) gateway lấy upload target (mirror `student-verification-gateway`); (3) selector loại evidence theo pattern chọn level; nút chọn file chỉ khi `certificate`; (4) submit đúng payload, lỗi hiển thị bằng banner có sẵn; (5) history hiện `certificate`; (6) test gateway + payload, không log URL ký sẵn.
- **Verification:** `verifier_assessment` không còn là giá trị hardcode duy nhất; spec mới PASS.
- **Regression Checks:** luồng verifier_assessment cũ; verifier queue (M9) không đổi; student verification upload nguyên; không rò URL.
- **Exit Criteria:** nộp được certificate có file từ mobile; history đúng loại.

### MM6 — "Bạn đã nộp gì" cho student verification (Phase 4)

- **Current State:** `verification.tsx` chỉ hiện submission mới nhất (M7). B8: view có `documentId` nullable (`verification.ts:63`), `GET /student-verifications/:id/document` (`controller:164`) trả `documentDownloadTargetSchema`. Không có FR cho lịch sử (M15).
- **Root Cause:** `documentId` trước đây lưu nhưng không trả về; sau B8 mobile chưa tiêu thụ.
- **Scope:** hiển thị tham chiếu tài liệu đã nộp + mở file qua `downloadUrl`; **không** thêm UI lịch sử đa bản ghi — dùng copy "current submission".
- **Allowed Files:** `verification.tsx`, `student-verification-gateway.ts`(+spec), `api-evidence.ts`(+spec), `i18n/*.json`.
- **Forbidden Files:** `apps/api/**`, `packages/contracts/**`.
- **Tasks:** (1) Phase 0 đọc `verification.ts:55-70`, `index.ts:440-450` (field + TTL `downloadUrl`); (2) gateway `getDocumentDownload(id)` parse `documentDownloadTargetSchema`; (3) dòng "Tài liệu đã nộp" + nút mở (`Linking.openURL`, `AppButton tone="quiet"`); (4) copy "current submission" en/vi; (5) `documentId` null → ẩn; (6) test gateway + ẩn/hiện.
- **Verification:** spec PASS; không log `downloadUrl`; typecheck PASS.
- **Regression Checks:** picker → bytes → presigned PUT → submit giữ nguyên; trạng thái pending/approved/rejected + lý do như cũ.
- **Exit Criteria:** thấy tài liệu đã nộp; không có UI lịch sử mới; R-06 ghi nhận.

### MM7 — Filter parity (Phase 5, cần quyết định)

- **Current State:** `marketplace-view.tsx:98-138` chỉ có keyword + một skill. `listClassesQuerySchema` (`mobile-classes.ts:151-168`) nhận `q/keyword`, `skillId`, `startDate`, `endDate`, `teacherId`, `state`, `limit`, `cursor` — **không có** `format`/`verified`/`school`/`level` (đó là field response B2–B4).
- **Root Cause:** hẹp có chủ đích cho 360 px nhưng chưa được *tuyên bố*, nên web và mobile cho kết quả khác nhau.
- **Scope:** chỉ phần server hỗ trợ sẵn hoặc tài liệu hoá; không lọc client-side trên trang đã phân trang (sai kết quả).
- **Allowed Files:** `explore.tsx`, `marketplace-filters*`, `marketplace-card.tsx` (chỉ badge B2–B4 nếu chọn C), i18n, test.
- **Forbidden Files:** logic `nextCursor` + dedupe trong `marketplace-view.tsx`; `apps/api/**`; `packages/contracts/**`.
- **Tasks (Phase 0 chốt một phương án, mặc định A):** **A** không đổi UI, ghi R-04/R-07; **B** khung thời gian qua `startDate`/`endDate` (server có sẵn), tái dùng chip; **C** hiển thị `level`/`format`/`verified`/`schoolName` ở card (read-only, không lọc).
- **Verification:** B: test gateway truyền đúng `startDate/endDate`, paging + dedupe còn nguyên; A: không có diff code.
- **Regression Checks:** cursor append + dedupe; keyword/skill filter; reset filter không mất trang.
- **Exit Criteria:** phương án đã chọn được thực hiện hoặc A được ghi nhận; không có filter client-side giả.

### MM8 — Profile read-only (Phase 5)

- **Current State:** `profile-view.tsx` read-only (không sửa display name/email); API không có route update (Audit §5 mục 6). Đổi ngôn ngữ vẫn persist.
- **Root Cause:** thiếu route cập nhật profile ở backend; mobile không thể bù mà không vi phạm khoá.
- **Scope:** không code; đóng bằng bằng chứng + Risk Register.
- **Allowed Files:** `profile-view.tsx` + `profile-view.spec.tsx` (chỉ khi phát hiện affordance chết).
- **Forbidden Files:** mọi thứ ngoài `apps/mobile/**`; không thêm màn edit giả.
- **Tasks:** (1) `git grep -n -E "@Patch|@Put" -- apps/api/src/modules/account-profile` xác nhận chưa có route update; (2) xác nhận không có nút dẫn tới hành động không tồn tại; (3) chạy `profile-view.spec.tsx`; (4) ghi R-08.
- **Verification:** spec PASS; recount ghi "no update route".
- **Regression Checks:** đổi ngôn ngữ persist; 5 link feature giữ nguyên, verifier chỉ cho role verifier.
- **Exit Criteria:** gap được tài liệu hoá, không đổi hành vi.

### MM9 — Bằng chứng push trên thiết bị thật (việc con người)

- **Current State:** registration, locale persistence, account rebind, dedup, tap-through đã có test/simulator; `tasks/todo.md` còn T02, T03, T21, T22 chưa tick.
- **Root Cause:** *evidence gap*, không phải lỗi code; commit không thể đóng.
- **Scope:** không code; chỉ theo dõi.
- **Allowed Files:** không sửa file nào.
- **Forbidden Files:** mọi file (đừng nhầm với M9 — `verifier-queue-view.tsx` vẫn được bảo vệ).
- **Tasks:** (1) ghi R-09 và nhắc cần thiết bị Android/iOS thật + dev client; (2) xác nhận `notification-target.spec.ts` + `notification-device-lifecycle.spec.ts` vẫn xanh sau MM4/MM11.
- **Verification:** test push hiện có PASS.
- **Regression Checks:** tap-through push không đổi sau khi đổi màn Notifications.
- **Exit Criteria:** R-09 ở trạng thái "Open — human task"; không claim sai là đã có bằng chứng thiết bị.

### MM12 — Dead UI modules (Phase 5)

- **Current State:** ứng viên (Phase 0 phải xác nhận importer = 0, **kể cả import tương đối và spec**): `ui/placeholder-view.tsx`, `ui/class-card.tsx`, `ui/hung/session.tsx`, `ui/hung/styles.ts`. Grep chỉ thấy `dashboard-view`, `upcoming-bookings-summary`, `book-button` có importer.
- **Root Cause:** màn hình cũ/được thay thế còn sót module; tăng bề mặt bảo trì và nhiễu cho audit.
- **Scope:** xoá file *chắc chắn* không được tham chiếu; nghi ngờ thì giữ và ghi Risk Register.
- **Allowed Files:** chỉ các file ứng viên nêu trên (xoá).
- **Forbidden Files:** file đang có importer; `verifier-queue-view.tsx`; ngoài `apps/mobile/**`.
- **Tasks:** (1) với từng ứng viên `git grep -n "<tên>" -- apps/mobile` (cả `@/ui/...` lẫn `./...`); (2) kiểm tra `.dependency-cruiser.cjs`, `jest.config.cjs`, docs không trỏ tới; (3) xoá file đã xác nhận, chạy `pnpm test:arch`; (4) lưu ý R-01: nhánh Vu Hung cũng sửa các file này.
- **Verification:** typecheck + test + test:arch PASS; không import hỏng.
- **Regression Checks:** Home tab (`dashboard-view`), summary đặt chỗ, `book-button` hoạt động.
- **Exit Criteria:** chỉ module chết đã chứng minh bị xoá; Progress Log liệt kê file + bằng chứng.

### MM13 — Ô nhập ngày publish (Phase 5)

- **Current State:** `teaching.tsx:19` mặc định `startsAt` là chuỗi ISO (`now + 48h`); `:116-120` là `TextInput` nhận chuỗi ISO thô; `:66` gửi nguyên giá trị.
- **Root Cause:** chưa có date/time picker; ô nhận chuỗi bất kỳ nên dễ sai định dạng và chỉ bị phát hiện ở server.
- **Scope:** validate + chuẩn hoá chuỗi ngày trước khi gửi, báo lỗi rõ; **không** thêm thư viện picker (khoá dependency).
- **Allowed Files:** `teaching.tsx`, helper validate trong `apps/mobile/src/**`, `i18n/*.json`, test.
- **Forbidden Files:** `package.json`, `pnpm-lock.yaml`, ngoài `apps/mobile/**`; không đổi layout form.
- **Tasks:** (1) hàm thuần `parseStartsAt(input)` → ISO hợp lệ hoặc lỗi (test: sai định dạng, quá khứ, thiếu offset); (2) chặn submit + banner lỗi có sẵn; (3) placeholder/gợi ý định dạng en/vi; (4) ghi R-10.
- **Verification:** unit test validate; test submit bị chặn với input xấu; payload hợp lệ giữ nguyên.
- **Regression Checks:** tạo/sửa/publish vẫn gửi `startsAt` ISO đúng; mặc định +48h giữ nguyên.
- **Exit Criteria:** input xấu không tới server; không đổi dependency.

### MM14 — Màn hình chưa có test (Phase 5, làm cuối)

- **Current State:** chưa có spec riêng: `notifications.tsx`, `skills.tsx`, `teaching.tsx`, `verification.tsx` (đã có spec cho gateway, coordinator, `teaching-class-detail`, `verifier-queue-view`, `profile-view`, `primitives`).
- **Root Cause:** màn viết theo nhịp demo, logic nằm trong component nên không được phủ.
- **Scope:** chỉ **thêm test** cho code đã đổi ở MM1/4/5/6/11/13 và hành vi cốt lõi; không refactor lớn.
- **Allowed Files:** `*.spec.ts(x)` mới/sửa trong `apps/mobile/**` (export hàm thuần tối thiểu nếu cần testability).
- **Forbidden Files:** code sản phẩm ngoài phần MM trước đã đổi; `verifier-queue-view.tsx`.
- **Tasks:** (1) notifications: title/body server, mark-read, mark-all, lỗi; (2) skills: chọn loại, payload `certificate` + `documentRef`; (3) verification: hiện/ẩn tài liệu; (4) teaching: không còn nút Complete, validate ngày; (5) mỗi test phải fail khi hoàn nguyên fix (mutation check thủ công một lần).
- **Verification:** `pnpm --filter @skillswap/mobile test` PASS, số test tăng, chạy 2 lần không flaky.
- **Regression Checks:** không test phụ thuộc mạng/giờ thật; parity xanh.
- **Exit Criteria:** mỗi thay đổi hành vi ở MM1/4/5/6/11/13 đều có test bảo vệ.

---

## 12. Verification Gates

**Gate theo phase** (sau mỗi phase), cộng scope guard §5 và patch checkpoint:

```powershell
pnpm --filter @skillswap/mobile typecheck
pnpm --filter @skillswap/mobile test
```

**Gate cuối**, theo thứ tự:

| # | Lệnh | Pass khi |
|---|---|---|
| 1 | `pnpm typecheck` | build contracts + `pnpm -r typecheck` exit 0 |
| 2 | `pnpm test` | `pnpm -r --workspace-concurrency=1 test` exit 0 |
| 3 | `pnpm test:arch` | `depcruise` không vi phạm |
| 4 | `pnpm lint` | `eslint . --max-warnings=0` exit 0 |
| 5 | `pnpm verify` | lint + build + typecheck + test + arch exit 0 |
| 6 | `pnpm test:e2e` | e2e của `@skillswap/api` exit 0 (cần `pnpm db:up`) |
| 7 | Scope guard §5 | rỗng |

Repo **không có** E2E riêng cho mobile; `pnpm test:e2e` là e2e backend, dùng để chứng minh thay đổi mobile không phá contract đang chạy. Cần Docker (postgres + rabbitmq); nếu không chạy được thì báo trung thực, không đánh dấu PASS (R-11).

---

## 13. Regression Checks

**Recount toàn cục** (từ thư mục gốc; luôn dùng `""` và một token, không có khoảng trắng trong pattern):

| Claim | Lệnh | Trước | Sau |
|---|---|---|---|
| Complete biến mất | `git grep -n "complete" -- apps/mobile/src/infrastructure/http/teaching-gateway.ts` | 2 | 0 |
| Spec không còn ghim route | `git grep -n "class-1/complete" -- apps/mobile/src` | 1 | 0 |
| Heading từ title | `git grep -n "ClassDetail.title" -- apps/mobile/src/ui/class-detail-view.tsx` | 1 | 0 |
| Copy từ server | `git grep -n "Notifications.body_" -- apps/mobile/app` | 1 | 0 |
| Reason đầy đủ | `git grep -n "learner_not_verified" -- apps/mobile/src` | 0 | ≥ 1 |
| Mark-read có | `git grep -n "markRead" -- apps/mobile/src/infrastructure/http/notification-gateway.ts` | 0 | ≥ 1 |
| Verifier queue nguyên vẹn | `git grep -n "documentRef" -- apps/mobile/src/ui/verifier-queue-view.tsx` | 4 | 4 |
| Backend nguyên vẹn | `git diff --stat -- apps/api apps/web packages/contracts` | rỗng | rỗng |

**Hành vi không được đổi:**

- [ ] `Linking.openURL` + poll wallet 120 s; không Jitsi nhúng.
- [ ] Không chat, Admin, Withdrawal, MFA trên mobile.
- [ ] `marketplace-view.tsx`: `nextCursor` + dedupe theo `id`.
- [ ] `verifier-queue-view.tsx` không có diff (M9).
- [ ] `availableSeats` thật (M24); relative time theo locale (M19).
- [ ] 5 tab + 5 link feature stack; không đổi navigation.
- [ ] Session: SecureStore, single-flight refresh, 401 về login.
- [ ] Tiền là số nguyên, không float; `messages-parity.spec.ts` xanh.

---

## 14. Risk Register

| ID | Mức | Rủi ro | Xử lý / Quyết định cần |
|---|---|---|---|
| R-01 | **Cao** | Nhánh chưa merge `origin/feat/vu-hung-mobile-completion` (8 commit) sửa 30 file `apps/mobile` (gồm `class-detail-view.tsx`, `notifications.tsx`, `teaching/[id].tsx`, `booking.ts`, `i18n/*.json`, `verifier-queue-view.tsx`, `package.json`) và đã chứa commit tương ứng MM1/MM10/MM4/MM11 — merge nhánh nào sau sẽ conflict nặng | **Cần user quyết:** (a) bỏ nhánh đó, làm theo plan; (b) rebase plan lên nhánh đó; (c) chia việc. Theo chỉ thị hiện tại plan giữ (a), không chạm nhánh đó |
| R-02 | Cao | `AGENTS.md`: "mỗi phase một commit riêng" ≠ chỉ thị "1 commit cuối, 1 push cuối" | **Cần user xác nhận.** Mặc định 1 commit; checkpoint bằng patch ngoài repo |
| R-03 | TB | Làm trực tiếp trên `main`; lịch sử cho thấy `main` đi qua PR (#99–#101) | Đề xuất nhánh `feat/mobile-api-audit-sync` + PR; **chờ user duyệt** trước khi tạo nhánh/push |
| R-04 | TB | Contract list thiếu query `format`/`verified`/`school`/`level` | MM7 không lọc server-side được; cần backend task (ngoài khoá) |
| R-05 | TB | B7 resolve copy theo locale **đã đăng ký ở thiết bị**; user chưa bật push có thể nhận copy mặc định | Phase 0 đọc `sql-notification-management.ts` + entity locale; nếu đúng → đề xuất backend dùng locale tài khoản/`Accept-Language` |
| R-06 | Thấp | Không có FR cho lịch sử student verification (M15) | MM6 chỉ "current submission"; chờ product |
| R-07 | Thấp | MM7 mặc định A không thêm filter, web/mobile vẫn lệch | Ghi rõ phạm vi; chọn B/C nếu user duyệt |
| R-08 | Thấp | Không có route cập nhật profile | Scope gap theo audit §5; cần backend nếu muốn |
| R-09 | TB | Thiếu bằng chứng push thiết bị thật (T02, T03, T21, T22) | Việc con người; không claim đã có |
| R-10 | Thấp | `package.json`/lockfile bị khoá | MM13 không thêm picker native; đề xuất task riêng nếu mở khoá |
| R-11 | TB | Không có E2E mobile; `pnpm test:e2e` là e2e backend, cần Docker | `pnpm db:up` trước; không chạy được thì báo "không chạy", không ghi PASS |
| R-12 | TB | `2026-11-07-mobile-implementation-remaining.md` và `…-backend-remaining-work.md` **không có trong repo**; MM8, MM12–MM14 suy ra từ audit §7 (hàng "Dead UI modules, publish date input, untested screens → MM12, MM13, MM14") | **Cần user cung cấp** file implementation plan để đối chiếu ở Phase 0 |
| R-13 | Thấp | Chưa đọc hết shape B8/B9 (field, TTL `downloadUrl`, điều kiện `documentRef`) | Phase 0 đọc `skill-evidence.ts`, `verification.ts`, `index.ts:440-450` |
| R-14 | Thấp | B10: docs `complete` còn stale (SRS:712, FRONTEND-API-GUIDE…) | Ngoài khoá (docs/backend); ghi nhận |
| R-15 | TB | 1 commit lớn, khó revert một phần | Patch checkpoint mỗi phase; commit body liệt kê từng MM |
| R-16 | Thấp | Windows sandbox: `git`/`pnpm` đôi khi lỗi `index.lock`/`FETCH_HEAD`/EPERM | Chạy lệnh ghi git ngoài sandbox; Node EPERM thử lại tối đa 2 lần |
| R-17 | TB | Backend: `GET /student-verifications/:id/document` chỉ cho `admin`/`verifier` → người học không mở lại được tài liệu của chính mình (MM6 không có nút tải) | Không sửa backend; đề xuất cho backend mở quyền owner như `GET /skill-evidence/:id/document`; mobile thêm nút sau đó |
| R-18 | Thấp | MM12 (audit only): 4 module UI không còn importer nào (`placeholder-view.tsx`, `class-card.tsx`, `ui/hung/session.tsx`, `ui/hung/styles.ts`) và chuỗi mock booking chỉ còn test dùng (`book-class-service.ts`, `mock-booking-gateway.ts`, `demo-class.ts`) | Không xoá trong audit này; đề xuất task dọn dẹp riêng sau khi user duyệt (lưu ý R-01: nhánh Vu Hung cũng sửa các file này) |
| R-19 | Thấp | MM13: ô `startsAt` vẫn là `TextInput` nhận chuỗi ISO (chỉ có validate, chưa có date/time picker); form sửa lớp ở `teaching/[id].tsx` dùng kiểm tra riêng (`Date.parse`) chứ chưa dùng `parseStartsAt` | Picker cần thêm dependency (bị khoá, xem R-10); đề xuất task riêng nếu mở khoá |

---

## 15. Progress Log

Quy ước: `thời gian | phase | MM | hành động | kết quả | bằng chứng`.

| Thời gian | Phase | MM | Hành động | Kết quả | Bằng chứng |
|---|---|---|---|---|---|
| 2026-11-09 16:00 | — | — | `git checkout main` + `pull --ff-only` | `main` = `16ba1aa` | `git log -n 1` |
| 2026-11-09 16:22 | — | — | Tạo master plan (khung) | Done | file này |
| 2026-11-09 16:30 | 0 | — | Recount baseline, đối chiếu B1–B9 | Khớp audit (§1, §9) | `git grep` ở §1 |
| 2026-11-09 16:32 | 0 | — | Đối chiếu nhánh Vu Hung | Phát hiện R-01 | `git diff --name-only origin/main origin/feat/vu-hung-mobile-completion -- apps/mobile` |
| 2026-11-09 16:35 | — | — | Viết lại master plan (bản thực thi) | Done, chưa sửa code | file này |
| 2026-11-09 16:50 | 0 | Baseline | Hoàn thành kiểm tra Phase 0 Audit Baseline | B1-B9 đã xác minh, audit findings chuẩn xác | Phần 1-4 báo cáo |

### Phase 0: Audit Baseline Execution
- **Date:** 2026-11-09 16:50
- **Repository State:** Branch `feature/mobile-api-audit` (dựa trên `main`), commit `16ba1aa`, working tree sạch (chỉ có master plan và file untracked cá nhân).
- **Capability Matrix Summary:**
  - B1 (Class Title): **Supported** (Server/Contracts đã có `title: z.string().min(1)`, mobile class detail heading chưa đọc).
  - B2 (Class Level): **Supported** (Server/Contracts đã có `level: skillLevelSchema.nullable()`, mobile chưa hiển thị).
  - B3 (Class Format): **Supported** (Server/Contracts đã có `format: classFormatSchema`, mobile chưa hiển thị).
  - B4 (Teacher School & Verified): **Supported** (Server/Contracts đã có `schoolName` & `verified`, mobile chưa hiển thị).
  - B5 (Recent Ratings & Aggregate): **Supported** (Contracts & API đã có `recentRatings`, mobile đã render ở `:541-552`).
  - B6 (Notification Read State): **Supported** (API có `@Post('read-all')` và `@Post(':id/read')`, mobile gateway chưa có hàm).
  - B7 (Notification Copy Locale): **Supported** (API/DB resolve theo locale thiết bị, mobile app hiện bỏ qua copy server).
  - B8 (Student Verification Document): **Supported** (Contracts/API có `documentId`, `downloadUrl`, mobile chưa hiển thị "đã nộp gì").
  - B9 (Certificate Evidence & Upload): **Supported** (Contracts có type `certificate`, API có route upload/read document, mobile đang hardcode `verifier_assessment`).
- **Audit Findings:**
  - *Vẫn đúng (Còn mở trên mobile):* M6/MM1 (Complete route 404), MM10 (Title detail heading static), MM11 (Bỏ qua copy server), MM4 (Thiếu mark-read), MM1 (Thiếu `learner_not_verified`), MM5 (Hardcode verifier_assessment), MM6 (Thiếu download/thông tin tài liệu đã nộp), MM13 (TextInput startsAt không validate).
  - *Đã được backend ship:* B1, B2, B3, B4, B5, B6, B7, B8, B9.
  - *Đã hoạt động tốt trên mobile (Giữ nguyên bảo vệ):* M9 (verifier-queue-view render `description` + `documentRef`), M2 (phân trang `nextCursor` + dedupe theo `id`), M19 (relative time), M24 (`availableSeats` thực tế).
- **Risks:** R-01 (Nhánh unmerged `origin/feat/vu-hung-mobile-completion`), R-02 (Quy ước commit), R-03 (Quy trình PR lên main), R-09 (Evidence push thiết bị thật là việc con người).

## Phase 1

- **Date:** 2026-11-09
- **MM:** MM1 (DROP Complete + thêm `learner_not_verified`) — **Complete**
- **Files Changed** (tất cả trong `apps/mobile/**`):
  - `src/infrastructure/http/teaching-gateway.ts` — xoá `complete()`
  - `app/(features)/teaching/[id].tsx` — xoá nút/handler Complete (start/cancel/edit giữ nguyên)
  - `src/infrastructure/http/api-evidence.ts` + `.spec.ts` — bỏ `complete` khỏi allowlist; thêm test route complete = `null`
  - `src/infrastructure/http/teaching-gateway.spec.ts` — bỏ assertion complete; thêm test "không có complete"
  - `src/ui/teaching-class-detail.spec.tsx` — bỏ mock `complete`; test không có nút Complete, vẫn có save/cancel/start
  - `src/domain/booking/booking.ts` — thêm `learner_not_verified` vào `BOOKING_REJECTION_REASONS`
  - `src/domain/booking/booking.spec.ts` (mới) — reason + đủ thông điệp en/vi
  - `src/ui/class-detail-coordinator.ts` + `.spec.ts` — đọc `errorDetails.code` khi là reason đã biết (trước đây chỉ nhận `errorDetails` dạng string nên reason luôn `unknown`); thêm test
  - `src/ui/class-detail-view.tsx` — map `learner_not_verified` → `ClassDetail.errorLearnerNotVerified`
  - `src/i18n/en.json`, `vi.json` — chỉ thêm 2 key mới mỗi file: `Booking.error.learner_not_verified`, `ClassDetail.errorLearnerNotVerified`
- **Verification Results:**
  - `git grep -n "complete" -- apps/mobile/src/infrastructure/http/teaching-gateway.ts` → 0 match
  - `git grep -n "class-1/complete" -- apps/mobile/src` → 0 match
  - `git grep -n "learner_not_verified" -- apps/mobile/src` → domain, UI mapping (`class-detail-view.tsx`), i18n, tests
  - `git diff --name-only` → chỉ `apps/mobile/**` (không có api/web/contracts)
- **Typecheck Result:** `pnpm --filter @skillswap/mobile typecheck` → PASS (exit 0)
- **Test Result:** `pnpm --filter @skillswap/mobile test` → 36/36 suites, 269/269 tests PASS
- **Regression Result:** start/cancel/edit không đổi code; `teaching-gateway.spec` vẫn khẳng định PATCH + `/cancel` + `/start`; screen spec xác nhận nút save/cancel/start còn, Complete không còn.
- **Open Risks:**
  - `Teaching.complete` i18n key giờ không còn tham chiếu — giữ lại do I18N lock (chỉ thêm key); dọn ở MM12 nếu muốn.
  - Môi trường: `packages/contracts/dist` (gitignored) cũ làm typecheck/test lỗi giả (`title`, `verified`…); đã chạy `pnpm --filter @skillswap/contracts build` để tái tạo, không đổi source. Máy khác cần build contracts trước khi chạy gate.
  - Backend gửi reason qua `errorDetails.code` (envelope); nếu gateway đổi dạng lỗi thì reason rơi về `unknown` (không cần sửa backend).

## Phase 2

- **Date:** 2026-11-09
- **MM:** MM10 (FIX - Heading title & Description clean), MM2 (VERIFY ONLY - Title parity), MM3 (VERIFY ONLY - Rating read-back) — **Complete**
- **Files Changed:**
  - `apps/mobile/src/ui/class-detail-view.tsx` — sửa heading ưu tiên `detail.title?.trim() ? detail.title : t('ClassDetail.title')`; loại bỏ `detail.title` khỏi khối Description (chỉ render `detail.description`).
  - `apps/mobile/src/ui/class-detail-view.spec.tsx` (mới) — unit tests kiểm chứng MM10 (heading title, description isolation, fallback khi title rỗng), MM3 (render recent ratings khi có dữ liệu từ server, fallback empty reviews khi rỗng).
- **MM10 Result:**
  - Main heading render `detail.title?.trim() ? detail.title : t('ClassDetail.title')`.
  - Khối Description chỉ hiển thị `detail.description` (`styles.descriptionText`), không còn `detail.title` chèn bên dưới nhãn description.
- **MM2 Verification Result:**
  - `apps/mobile/src/ui/marketplace-card.tsx:102`: đã dùng `{item.title}` hiển thị tiêu đề thẻ lớp học.
  - `apps/mobile/src/ui/my-bookings-view.tsx:468,535`: đã dùng `{item.classSummary.title}` hiển thị tiêu đề trong danh sách booking và nhãn accessibility.
  - Cả hai view đã consume `title` chuẩn xác, không có hồi quy -> **Giữ nguyên (No change required)**.
- **MM3 Verification Result:**
  - `apps/mobile/src/ui/class-detail-view.tsx:264-275, 540-553`: kiểm tra render `detail.teacher.averageRating`, `detail.teacher.ratingsCount` và `detail.recentRatings`. Khi server trả mảng ratings, UI render danh sách đánh giá đầy đủ (author, stars, comment). Chỉ hiển thị "No reviews yet" (`t('ClassDetail.noReviews')`) khi `recentRatings.length === 0`.
  - Không có bug rendering kẹt cứng -> **Giữ nguyên (No change required)**.
- **Verification Results:**
  - `git grep -n "ClassDetail.title" -- apps/mobile/src/ui/class-detail-view.tsx`:
    `315: {detail.title?.trim() ? detail.title : t('ClassDetail.title')}`
  - `git grep -n "ClassDetail.description" -- apps/mobile/src/ui/class-detail-view.tsx`:
    `338: <Text style={styles.sectionTitle}>{t('ClassDetail.description')}</Text>`
  - `git diff --name-only`: Chỉ thay đổi trong `apps/mobile/**` và master plan.
- **Typecheck Result:** `pnpm --filter @skillswap/mobile typecheck` → PASS (exit 0)
- **Test Result:** `pnpm --filter @skillswap/mobile test` → 37/37 suites, 274/274 tests PASS
- **Regression Result:**
  - Booking flow / coordinator không đổi logic.
  - Hold/confirm/cancel flow giữ nguyên.
  - `availableSeats` (M24), `detail.skills`, teacher section và marketplace pagination/dedupe hoàn toàn được bảo vệ.
- **Open Risks:**
  - Không phát sinh risk mới.

## Phase 3

- **Date:** 2026-11-09
- **MM:** MM11 (copy server cho notification), MM4 (mark-read / mark-all-read) — **Complete**
- **Files Changed** (tất cả trong `apps/mobile/**`):
  - `src/infrastructure/http/notification-gateway.ts` — thêm `markRead(id)` → `POST /notifications/:id/read`, `markAllRead()` → `POST /notifications/read-all`; cả hai parse `markNotificationsReadResponseSchema` có sẵn trong `@skillswap/contracts` (không schema mới).
  - `src/infrastructure/http/notification-gateway.spec.ts` — test URL/method/encode id, parse `unreadCount`, từ chối response sai contract.
  - `src/infrastructure/http/api-evidence.ts` + `.spec.ts` — allowlist thêm `/notifications/read-all` và `/notifications/:id/read` (id được template hoá).
  - `src/ui/notification-copy.ts` (mới) — hàm thuần `notificationCopy`: ưu tiên `item.title`/`item.body` của server, chỉ fallback `Notifications.type_*`/`body_*` khi rỗng/blank; key thiếu không bao giờ hiện ra (title rơi về `Notifications.title`, body bị ẩn).
  - `app/(features)/notifications.tsx` — dùng `notificationCopy`; tap item chưa đọc gọi `markRead` (không chặn điều hướng, không chờ kết quả); nút "Mark all as read" (`AppButton tone="quiet"`, chỉ hiện khi `unread > 0`); `unread` lấy từ response server; lỗi dùng `FeedbackBanner` có sẵn.
  - `src/ui/notifications-screen.spec.tsx` (mới) — 9 test cho màn hình.
  - `src/i18n/en.json`, `vi.json` — chỉ thêm 3 key mới mỗi file: `Notifications.markAllRead`, `markReadError`, `markAllReadError`.
- **MM11 Result:** màn hình hiển thị `item.title`/`item.body` theo locale server. Fallback client chỉ khi blank. `Notifications.type_*`/`body_*` không còn ở `apps/mobile/app` (logic fallback nằm trong `src/ui/notification-copy.ts`). Routing/`notification-target.ts`/push lifecycle không đổi. Các key `type_*`/`body_*` được giữ trong en/vi vì vẫn là fallback.
- **MM4 Result:** gateway + UI hoạt động. markRead thất bại → vẫn điều hướng ngay, hiện banner `markReadError`, `unread` giữ nguyên. markAllRead thất bại → giữ nguyên items/unread, hiện banner `markAllReadError`. Có guard chống gọi trùng markRead cùng id và chống double-submit mark-all (`busy`).
- **Verification Results:**
  - `git grep -n "markRead" -- apps/mobile` → gateway, màn hình, spec, i18n (≥ 1).
  - `git grep -n "markAllRead" -- apps/mobile` → gateway, màn hình, spec, i18n.
  - `git grep -n "Notifications.body_" -- apps/mobile/app` → 0 match.
  - `git diff --name-only` → chỉ `apps/mobile/**` (plan chưa được git theo dõi); không có api/web/contracts/lockfile.
- **Typecheck Result:** `pnpm --filter @skillswap/mobile typecheck` → PASS (exit 0)
- **Test Result:** `pnpm --filter @skillswap/mobile test` → 38/38 suites, 286/286 tests PASS (gồm `messages-parity`)
- **Architecture Test Result:** `pnpm test:arch` → PASS ("no dependency violations found", 1041 modules)
- **Regression Result:** `notification-target.ts`, `notification-device-lifecycle.ts`, `src/infrastructure/push/**`, `verifier-queue-view.tsx`, marketplace pagination, wallet không có diff. Push enable/disable và load-more/cursor giữ nguyên code.
- **Open Risks:**
  - R-05: key `Notifications.type_*`/`body_*` còn trong en/vi do là fallback; chỉ xoá được khi backend đảm bảo `title`/`body` luôn có (contract hiện `min(1)`, nên fallback gần như không kích hoạt).
  - Chưa kiểm chứng trên thiết bị thật/server thật: response mark-read đi qua envelope `data` giống các route khác (test dùng envelope giả lập). Nếu server trả khác shape, gateway sẽ báo lỗi contract và UI hiện banner (không crash).
  - Mark-read chạy nền sau khi điều hướng: nếu thất bại, banner chỉ thấy khi người dùng quay lại màn Notifications (màn tự tải lại khi focus).

## Phase 4

- **Date:** 2026-11-09
- **MM:** MM5 (certificate evidence), MM6 (current submission) — **Complete**
- **Files Changed** (tất cả trong `apps/mobile/**`):
  - `src/infrastructure/http/student-verification-gateway.ts` — chỉ nới kiểu tham số của `uploadDocument` thành `SignedUploadTarget` (`uploadUrl`/`fields`/`expiresAt`) để dùng chung flow upload cho target certificate (không có `documentId`). Không đổi hành vi.
  - `src/infrastructure/http/skill-evidence-gateway.ts` + `.spec.ts` — thêm `requestDocumentUpload` (`POST /skill-evidence/documents`) và `submitCertificateEvidence` (target → `StudentVerificationGateway.uploadDocument` → submit `evidenceType: certificate`, `documentRef = objectKey`); cập nhật comment lỗi thời "không có upload endpoint". Không viết code upload mới.
  - `src/infrastructure/http/api-evidence.ts` + `.spec.ts` — allowlist `/skill-evidence/documents`.
  - `app/(features)/skills.tsx` — chọn loại evidence (`verifier_assessment` mặc định / `certificate`), nút chọn file chỉ khi `certificate`, submit rẽ nhánh; history hiển thị loại evidence.
  - `app/(features)/verification.tsx` — khối "Current submission" (ẩn khi không có `documentId`).
  - `src/i18n/en.json`, `vi.json` — chỉ thêm key mới: `Skills.evidenceType`, `Skills.type_certificate`, `Skills.type_verifier_assessment`, `Skills.chooseCertificate`, `Verification.currentSubmission`, `Verification.documentSubmitted`, `Verification.submittedAt`.
  - `src/ui/skills-screen.spec.tsx` (mới), `src/ui/verification-screen.spec.tsx` (mới).
- **MM5 Result:** chọn được `certificate` → chọn file (cùng picker `image/*` + PDF như Verification) → upload qua flow dùng chung → submit với `documentRef` = `objectKey` server trả về. Flow `verifier_assessment` giữ nguyên payload (không `documentRef`), nút Submit vẫn yêu cầu mô tả như cũ; certificate yêu cầu file, mô tả tuỳ chọn (contract cho phép). Lỗi upload → không submit evidence (có test); UI hiện `Skills.submitError`, giữ form. History hiển thị `loại · level · trạng thái` (có `certificate`).
- **MM6 Result:** khi server trả `documentId` hiển thị "Hồ sơ nộp hiện tại / Current submission" gồm tên trường, tài liệu đã nộp (`documentId`), thời điểm nộp theo locale. Ẩn khi `documentId` là null/absent/rỗng hoặc chưa từng nộp. Không thêm history, không thêm multi-submission. `StudentVerificationView` chỉ có `documentId` (không có `documentRef`) nên không bịa field — `documentRef` chỉ thuộc skill evidence (MM5).
- **Quyết định về download (MM6):** KHÔNG thêm nút mở/tải tài liệu. `GET /student-verifications/:id/document` chỉ cho role `admin`/`verifier` (`student-verification.controller.ts:164-166`), người học (role `user`) sẽ luôn 403. Ghi Risk Register, không sửa backend.
- **Verification Results:**
  - `git grep -n "certificate" -- apps/mobile` → skills screen, gateway + spec, i18n (kèm các match cũ của verifier).
  - `git grep -n "documentRef" -- apps/mobile` → gateway + spec; `verifier-queue-view.tsx` giữ nguyên (không sửa).
  - `git grep -n "documentId" -- apps/mobile` → `verification.tsx`, student-verification gateway + spec.
  - (`git grep` chỉ quét file đã tracked; spec mới chưa `git add` nên không hiện.)
  - `git diff --name-only` → chỉ `apps/mobile/**`; không có api/web/contracts/lockfile/package.json.
- **Typecheck Result:** `pnpm --filter @skillswap/mobile typecheck` → PASS (exit 0)
- **Test Result:** `pnpm --filter @skillswap/mobile test` → 40/40 suites, 302/302 tests PASS (gồm `messages-parity`)
- **Architecture Test Result:** `pnpm test:arch` → PASS ("no dependency violations found", 1043 modules)
- **Regression Result:** student-verification gateway spec (upload/submit) xanh không đổi; `verifier-queue-view.tsx`, notifications (Phase 3), marketplace, teaching, wallet, `src/infrastructure/push/**` không có diff mới trong Phase 4.
- **Open Risks:**
  - **R-17 (mới, backend):** người học không thể mở lại tài liệu student verification của chính mình vì `GET /student-verifications/:id/document` giới hạn `admin`/`verifier`. Đề xuất cho backend: cho phép owner (như `GET /skill-evidence/:id/document` cho `user`). Mobile sẽ thêm nút "mở" (MM6 gốc) sau khi backend mở quyền.
  - Certificate đã nộp chưa có nút xem lại trên mobile: `GET /skill-evidence/:id/document` cho phép owner nhưng nằm ngoài yêu cầu Phase 4; có thể làm sau bằng `documentDownloadTargetSchema` (không log URL ký sẵn).
  - `documentId` hiển thị là mã tham chiếu thô (opaque) — đúng yêu cầu "hiển thị thông tin đó"; nếu cần tên file, backend phải trả thêm field (ghi nhận, không sửa).
  - Chưa chạy upload thật tới Cloudinary/server thật; kiểm chứng bằng mock fetch + signed-field assertions (chỉ gateway/test).

## Phase 5

- **Date:** 2026-11-09
- **MM:** MM7 (Option A, no change), MM8 (verify only), MM12 (audit only), MM13 (code), MM14 (test cho MM13) — **Complete**
- **Files Changed** (chỉ MM13/MM14 có thay đổi code):
  - `src/ui/teaching-form.ts` (mới) — `parseStartsAt(input, now?)` → `{ ok: true, value } | { ok: false, error: 'empty' | 'invalid' | 'past' }` và `startsAtMessageKey`. Định dạng được kiểm bằng chính schema `startsAt` của `createClassSchema` (contracts, chỉ đọc) nên không lệch với gateway/server; `value` là chuỗi đã trim, không format lại.
  - `app/(features)/teaching.tsx` — `create()` gọi `parseStartsAt` trước khi gửi; lỗi → chặn submit và hiện `FeedbackBanner` có sẵn; hợp lệ → payload giữ nguyên (`startsAt` đúng chuỗi người dùng nhập). Không đổi layout/ô nhập/nút.
  - `src/i18n/en.json`, `vi.json` — chỉ thêm 3 key mới: `Teaching.startsAtEmpty`, `startsAtInvalid`, `startsAtPast`.
  - `src/ui/teaching-form.spec.ts` (mới), `src/ui/teaching-screen.spec.tsx` (mới).
- **MM7 Result (Option A — không đổi code):** `marketplace-view.tsx` và `class-read-gateway.ts` không có diff. Mobile chỉ gửi `q` (từ `keyword`), `skillId`, `limit`, `cursor` — đều nằm trong `listClassesQuerySchema` (`mobile-classes.ts:151-168`). `nextCursor` được giữ ở state và gửi lại khi tải thêm (`marketplace-view.tsx:147-165`); dedupe theo `id` bằng `Set` ở lần tải đầu (`:122-123`), khi append (`:162-163`) và ở danh mục skill (`:78-79`). Test hiện có (`class-read-gateway.spec.ts`, các spec paging) vẫn PASS. Parity gap (ghi nhận, không sửa): contract list không có `format`/`level`/`school`/`verified` (R-04, R-07); server còn hỗ trợ `startDate`/`endDate`/`state` mà mobile không dùng (Option A).
- **MM8 Result (verify only — không đổi code):** `git grep -E "@Patch|@Put" -- apps/api/src/modules/account-profile` → 0 match, không có route cập nhật profile. `profile-view.tsx` không có diff; vẫn có đủ 5 link feature (`verification`, `skills`, `teaching`, `notifications`, và `verifier` chỉ cho role verifier) và chuyển ngôn ngữ `setLocale('vi'|'en')`. Không có nút sửa/disabled/placeholder. `profile-view.spec.tsx` PASS. Gap ghi ở R-08.
- **MM12 Result (audit only — KHÔNG xoá/đổi tên/di chuyển file nào):** quét import theo cú pháp (`from '…/<tên>'`) trên toàn bộ `git ls-files apps/mobile` + tìm trong config/docs. Kết quả:

  | Module | Importer prod | Importer spec | Phân loại |
  |---|---|---|---|
  | `src/ui/placeholder-view.tsx` | 0 | 0 | **Definitely dead** |
  | `src/ui/class-card.tsx` | 0 | 0 | **Definitely dead** |
  | `src/ui/hung/session.tsx` | 0 | 0 | **Definitely dead** |
  | `src/ui/hung/styles.ts` | 0 | 0 | **Definitely dead** |
  | `src/application/book-class-service.ts` | 0 | 2 | **Maybe dead** (chỉ test dùng) |
  | `src/infrastructure/mock/mock-booking-gateway.ts` | 1 (từ `placeholder-view`, dead) | 2 | **Maybe dead** (chuỗi mock, test đang ghim `BookingError`) |
  | `src/infrastructure/mock/demo-class.ts` | 1 (từ mock gateway) | 2 | **Maybe dead** |
  | `dashboard-view`, `upcoming-bookings-summary`, `book-button` | ≥ 1 | — | **Active** (`(tabs)/index.tsx`, `dashboard-view.tsx`, `class-detail-view.tsx`) |

  Không file nào được `.dependency-cruiser.cjs`, `jest.config.cjs`, `tsconfig.json` hay `package.json` của mobile tham chiếu. `placeholder-view.tsx` là importer duy nhất của chuỗi mock. Bản `docs/plans/2026-10-15-…` chỉ nhắc `class-card` ở bối cảnh web/cũ. Ghi vào Risk Register là R-18.
- **MM13 Result:** validate 4 trường hợp tối thiểu — rỗng, ISO sai định dạng (gồm thiếu múi giờ, chỉ có ngày), ngày không tồn tại (tháng 13, 31/2), ngày quá khứ (kể cả bằng đúng thời điểm hiện tại). Giá trị mặc định điền sẵn (`now + 48h`) vẫn publish được. Không thêm dependency/picker.
- **MM14 Result:** chỉ thêm test cho code MM13 (không mở rộng sang module khác, không tạo test cho MM7/MM8/MM12): 22 test — hàm thuần (hợp lệ, trim, rỗng, sai định dạng, ngày không tồn tại, quá khứ, so sánh theo thời điểm chứ không theo chuỗi offset, đủ key en/vi) và màn hình (4 lỗi chặn submit + banner, payload hợp lệ giữ nguyên, giá trị mặc định vẫn publish).
- **Typecheck Result:** `pnpm --filter @skillswap/mobile typecheck` → PASS (exit 0)
- **Test Result:** `pnpm --filter @skillswap/mobile test` → 42/42 suites, 324/324 tests PASS (gồm `messages-parity`)
- **Lint Result:** `pnpm lint` (`eslint . --max-warnings=0`) → PASS (exit 0)
- **Architecture Test Result:** `pnpm test:arch` → PASS ("no dependency violations found", 1046 modules)
- **Route Check:** `git ls-files apps/mobile/app` → 20 file, giống trước Phase 5; không route mới, không route bị xoá/đổi tên.
- **Regression Result:** không có diff ở `marketplace-view.tsx`, `marketplace-card.tsx`, `class-read-gateway.ts`, `profile-view.tsx`, `verifier-queue-view.tsx`, `wallet-view.tsx`, `src/infrastructure/push/**`, `apps/mobile/package.json`. Notification (Phase 3), verification + certificate (Phase 4) không đổi trong Phase 5; spec của chúng vẫn PASS trong full suite.
- **Final Report (draft):**
  - Mobile đã sync: bỏ Complete (MM1), `learner_not_verified` (MM1), heading/description lớp (MM10), copy server + mark-read (MM11, MM4), certificate evidence (MM5), current submission (MM6), validate `startsAt` (MM13).
  - Chỉ xác nhận, không đổi: MM2, MM3, MM7 (Option A), MM8.
  - MM9: Pending physical-device verification (việc con người, R-09).
  - Audit only: MM12 — 4 module definitely dead, 3 module maybe dead (R-18).
  - Backend gap đã ghi: R-04/R-07 (filter), R-05 (locale copy), R-08 (không có update profile), R-17 (owner không tải được tài liệu student verification), R-14 (docs `complete` stale).
- **Open Risks:** R-18, R-19 (mới); R-04, R-07, R-08, R-17 vẫn mở. Chưa có E2E mobile (R-11); `pnpm verify`/`pnpm test:e2e` thuộc Final Audit, chưa chạy ở phase này.

## Phase 6

- **Date:** 2026-11-09
- **Final Audit Result:** **Ready For Commit = YES** — báo cáo đầy đủ ở [2026-11-09-mobile-api-audit-final-report.md](./2026-11-09-mobile-api-audit-final-report.md).
- **Scope:** 21 file tracked đã sửa + 9 file mới, tất cả trong `apps/mobile/**`; scope guard rỗng; `apps/api`, `apps/web`, `packages/contracts`, lockfile, `package.json`, `turbo.json`, `.github` không đổi (kiểm tra lại sau khi chạy `verify`). 20 route `apps/mobile/app` không đổi.
- **MM Status:** MM1, MM4, MM5, MM6, MM10, MM11, MM13 = Complete (code); MM2, MM3, MM7 (Option A), MM8 = Complete (verify, không đổi code); MM12 = Complete (audit only, không xoá file); MM14 = Complete (đúng phạm vi); **MM9 = Human Task — Pending physical-device verification (không Complete)**. MM6 giới hạn bởi R-17.
- **Recount:** `complete`=0, `class-1/complete`=0, `Notifications.body_`=0, `learner_not_verified`=7, `markRead`=4, `documentRef` ở `verifier-queue-view.tsx`=4 (không đổi so với HEAD). **Ngoại lệ:** `ClassDetail.title`=1 (kỳ vọng 0) — fallback có chủ đích theo yêu cầu Phase 2; xoá được bằng 1 dòng + 1 test nếu muốn khớp 0. Danh sách reason mobile = backend `booking.ts:30-39` (8/8, cùng thứ tự) — bước đối chiếu của MM1 Task 7 được làm bù ở phase này.
- **Protected Areas:** `verifier-queue-view.tsx`, `notification-target.ts`/`push/**`, marketplace pagination (`marketplace-view.tsx`, `marketplace-card.tsx`, `class-read-gateway.ts`), wallet polling (`wallet-view.tsx`, `wallet-service.ts`), `profile-view.tsx` — không có diff.
- **I18N:** en/vi cùng +15 key mới (388 → 403), bộ key giống hệt, 0 key bị xoá/đổi, `messages-parity` PASS. Phát hiện `Wallet.statusReversed` trùng key (dòng 105/115) — **có sẵn từ HEAD**, không do audit, không sửa.
- **Typecheck Result:** `pnpm typecheck` → PASS (exit 0)
- **Test Result:** `pnpm test` → PASS (exit 0); mobile 42/42 suite, 324/324 test; web 57 file/446 test; contracts+gateway+api 4/12/165 suite (37/251/1159 test)
- **Architecture Result:** `pnpm test:arch` → PASS (1046 modules, 0 vi phạm)
- **Lint Result:** `pnpm lint` → PASS (0 warning)
- **Verify Result:** `pnpm verify` → PASS (exit 0)
- **E2E Result:** `pnpm test:e2e` → **Not Executed (môi trường)**: 80/80 test fail cùng lỗi `JaaS private key not readable at .secrets\jaas-private.pem`; Docker daemon không chạy, `localhost:5432`/`5672` không lắng nghe. Không do thay đổi mobile; không sửa backend; không chạy `pnpm keys:gen`/Docker. Ghi theo R-11, không ghi PASS.
- **Open Risks:** R-04, R-07, R-08, R-11, R-17, R-18, R-19 (chi tiết Description/Impact/Recommendation/Status ở báo cáo cuối). Lưu ý process: R-01 (nhánh Vu Hung trùng 19 file), R-02 (1 commit cuối vs `AGENTS.md`), R-03 (nhánh chưa có upstream, chờ duyệt trước khi push).
- **Recommended Commit:** `fix(mobile): sync mobile flows with API audit` (45 ký tự). Chỉ `git add apps/mobile docs/plans/2026-11-09-mobile-api-audit-master-plan.md docs/plans/2026-11-09-mobile-api-audit-final-report.md`; không thêm `.vscode/`, `folder-structure.txt`. Chưa commit/push.

---

## 16. Final Audit Checklist

**Trước commit**

- [ ] Recount §13 đạt cột "Sau"
- [ ] Scope guard §5 rỗng (chỉ `apps/mobile/**` + master plan)
- [ ] `git diff --stat -- apps/api apps/web packages/contracts pnpm-lock.yaml package.json .github` rỗng
- [ ] `verifier-queue-view.tsx` không có diff (hoặc có lý do compile bắt buộc trong Progress Log)
- [ ] Không thêm dependency; không đổi `apps/mobile/package.json`
- [ ] en/vi parity xanh; không chuỗi cứng mới trong UI
- [ ] Không float cho tiền; không log URL ký sẵn/token

**Gate cuối**

- [ ] `pnpm typecheck` · `pnpm test` · `pnpm test:arch` · `pnpm lint` PASS (0 warning)
- [ ] `pnpm verify` PASS
- [ ] `pnpm test:e2e` PASS (hoặc ghi rõ lý do không chạy — R-11)

**Commit & push**

- [ ] `git fetch origin`; `HEAD..origin/main` rỗng (hoặc đã rebase + chạy lại gate)
- [ ] Đúng **1 commit**, `type(scope): subject` ≤ 72 ký tự, body nêu *why* + liệt kê MM
- [ ] Hook `githooks/commit-msg` đã bật (`git config core.hooksPath githooks`)
- [ ] Đúng **1 lần push**, không `--force`, không `--no-verify`
- [ ] Đã cập nhật Progress Log + Risk Register

**Đóng từng MM**

| MM | Loại | Đóng khi |
|---|---|---|
| MM1 | Code | không còn `complete`, đủ reason |
| MM10 | Code | heading = title |
| MM2 | Verify | bằng chứng title ở card/booking row |
| MM3 | Verify | bằng chứng rating read-back |
| MM11 | Code | hiển thị title/body server |
| MM4 | Code | mark-read + mark-all hoạt động |
| MM5 | Code | nộp được certificate |
| MM6 | Code | thấy tài liệu đã nộp |
| MM7 | Quyết định | phương án A/B/C đã thực hiện/ghi nhận |
| MM8 | Tài liệu | R-08 ghi nhận, không đổi hành vi |
| MM9 | Con người | R-09 Open — ngoài commit |
| MM12 | Code | chỉ xoá module chết đã chứng minh |
| MM13 | Code | validate ngày, không đổi dependency |
| MM14 | Test | mỗi thay đổi hành vi có test |
## Scope Verification

- [ ] Không có file apps/api thay đổi
- [ ] Không có file apps/web thay đổi
- [ ] Không có file packages/contracts thay đổi
- [ ] Không có thay đổi pnpm-lock.yaml

## Protected Area Verification

- [ ] verifier-queue-view.tsx không bị sửa
- [ ] marketplace pagination không thay đổi
- [ ] notification-target.ts không thay đổi
- [ ] wallet polling flow không thay đổi

## UI Consistency Verification

- [ ] Không có redesign
- [ ] Không có navigation change
- [ ] Không có hierarchy change
- [ ] Không có UX flow change

## Backend Synchronization Verification

- [ ] B1 consumed
- [ ] B5 consumed
- [ ] B6 consumed
- [ ] B7 consumed
- [ ] B8 consumed
- [ ] B9 consumed

## Commit Readiness

- [ ] Ready For Commit