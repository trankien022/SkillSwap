# Mobile Week 6 — bằng chứng runtime

Ngày nghiệm thu: 13/10/2026. Android Google Play AVD `Medium_Phone_API_37.0`.

## API thực từ app

26 method + route templates được ghi từ app; tất cả có ít nhất một response thành công. Log đã loại body, token, query và định danh riêng: `~/Downloads/skillswap-mobile-evidence-20261013/mobile-requests.jsonl`. `traceId` có phạm vi **client-request**, không phải trace xuyên backend. Status 0 biểu thị mất kết nối thử nghiệm. Callback mock và thao tác ops không tính vào 26 routes; storage PUT ghi riêng.

| Method | Route template | HTTP quan sát | Màn hình/thao tác | FR | Backend liên quan | Request mẫu (UTC, client trace) |
|---|---|---|---|---|---|---|
| DELETE | `/api/notification-devices/:id` | 200 | Hồ sơ → Thông báo và push / logout | FR-016 | account_profile: inbox, subscription và delivery | 2026-10-12T19:17:23.019Z / `mobile-1791832643019-v8r1x0xs` |
| GET | `/api/auth/me` | 0, 200 | Đăng ký / login / khôi phục session / logout / Dashboard | FR-001, FR-017 | account_profile: account và auth session | 2026-10-12T19:11:11.507Z / `mobile-1791832271507-btgnstnk` |
| GET | `/api/classes` | 200 | Khám phá / Lớp tôi dạy → Detail → Tạo/Sửa/Hủy | FR-005, FR-006, FR-020 | live_class: persisted class và edit lock | 2026-10-12T19:11:42.698Z / `mobile-1791832302698-ba0uxf04` |
| GET | `/api/classes/:id` | 200 | Khám phá / Lớp tôi dạy → Detail → Tạo/Sửa/Hủy | FR-005, FR-006, FR-020 | live_class: persisted class và edit lock | 2026-10-12T19:12:39.476Z / `mobile-1791832359476-60y0i5rn` |
| GET | `/api/classes/bookings/me` | 0, 200 | Detail → Giữ chỗ → Xác nhận / Lịch của tôi | FR-007, FR-009 | live_class: booking; wallet_ledger: settlement 100/90/10 | 2026-10-12T19:11:11.492Z / `mobile-1791832271492-d8yovei8` |
| GET | `/api/notifications` | 200 | Hồ sơ → Thông báo và push / logout | FR-016 | account_profile: inbox, subscription và delivery | 2026-10-12T19:35:24.398Z / `mobile-1791833724398-5ej97n69` |
| GET | `/api/profile-skills/me` | 200 | Hồ sơ → Kỹ năng giảng dạy → lịch sử | FR-003, FR-018 | skill_verification: catalogue, evidence và approved profile skill | 2026-10-12T19:31:25.180Z / `mobile-1791833485180-3tu9lc67` |
| GET | `/api/skill-evidence/:id/history` | 200 | Hồ sơ → Kỹ năng giảng dạy → lịch sử | FR-003, FR-018 | skill_verification: catalogue, evidence và approved profile skill | 2026-10-12T19:34:28.877Z / `mobile-1791833668877-2vqyhim0` |
| GET | `/api/skills` | 200 | Hồ sơ → Kỹ năng giảng dạy → lịch sử | FR-003, FR-018 | skill_verification: catalogue, evidence và approved profile skill | 2026-10-12T19:11:42.692Z / `mobile-1791832302692-i922ehaf` |
| GET | `/api/student-verifications/me` | 200 | Hồ sơ → Xác minh sinh viên | FR-002, FR-019 | student_verification: documents và verification status | 2026-10-12T19:28:47.807Z / `mobile-1791833327807-879gbema` |
| GET | `/api/wallet/balance` | 200 | Ví → Lịch sử / Nạp tiền | FR-008, FR-010 | wallet_ledger: balance, topup intent và ledger | 2026-10-12T19:11:15.899Z / `mobile-1791832275899-zhd6djni` |
| GET | `/api/wallet/history` | 200 | Ví → Lịch sử / Nạp tiền | FR-008, FR-010 | wallet_ledger: balance, topup intent và ledger | 2026-10-12T19:25:56.092Z / `mobile-1791833156092-a19cbz3l` |
| PATCH | `/api/classes/:id` | 200, 409 | Khám phá / Lớp tôi dạy → Detail → Tạo/Sửa/Hủy | FR-005, FR-006, FR-020 | live_class: persisted class và edit lock | 2026-10-12T19:19:59.882Z / `mobile-1791832799882-xk1w4qgb` |
| POST | `/api/auth/login` | 200 | Đăng ký / login / khôi phục session / logout / Dashboard | FR-001, FR-017 | account_profile: account và auth session | 2026-10-12T19:17:38.796Z / `mobile-1791832658796-dv0xwdpw` |
| POST | `/api/auth/logout` | 204 | Đăng ký / login / khôi phục session / logout / Dashboard | FR-001, FR-017 | account_profile: account và auth session | 2026-10-12T19:17:23.136Z / `mobile-1791832643136-p66o2828` |
| POST | `/api/auth/refresh` | 200 | Đăng ký / login / khôi phục session / logout / Dashboard | FR-001, FR-017 | account_profile: account và auth session | 2026-10-12T19:37:29.937Z / `mobile-1791833849937-q9k1ckc6` |
| POST | `/api/auth/register` | 201 | Đăng ký / login / khôi phục session / logout / Dashboard | FR-001, FR-017 | account_profile: account và auth session | 2026-10-12T19:37:16.942Z / `mobile-1791833836942-51zgyz75` |
| POST | `/api/classes` | 201 | Khám phá / Lớp tôi dạy → Detail → Tạo/Sửa/Hủy | FR-005, FR-006, FR-020 | live_class: persisted class và edit lock | 2026-10-12T19:23:05.966Z / `mobile-1791832985966-1asw1s84` |
| POST | `/api/classes/:id/bookings` | 201 | Detail → Giữ chỗ → Xác nhận / Lịch của tôi | FR-007, FR-009 | live_class: booking; wallet_ledger: settlement 100/90/10 | 2026-10-12T19:13:05.454Z / `mobile-1791832385454-34v1dyez` |
| POST | `/api/classes/:id/cancel` | 200 | Khám phá / Lớp tôi dạy → Detail → Tạo/Sửa/Hủy | FR-005, FR-006, FR-020 | live_class: persisted class và edit lock | 2026-10-12T19:20:33.267Z / `mobile-1791832833267-mwfz0dxv` |
| POST | `/api/classes/bookings/:bookingId/confirm` | 200 | Detail → Giữ chỗ → Xác nhận / Lịch của tôi | FR-007, FR-009 | live_class: booking; wallet_ledger: settlement 100/90/10 | 2026-10-12T19:13:36.187Z / `mobile-1791832416187-crza81qu` |
| POST | `/api/notification-devices` | 201 | Hồ sơ → Thông báo và push / logout | FR-016 | account_profile: inbox, subscription và delivery | 2026-10-12T19:11:29.126Z / `mobile-1791832289126-bl92kuti` |
| POST | `/api/skill-evidence` | 201 | Hồ sơ → Kỹ năng giảng dạy → lịch sử | FR-003, FR-018 | skill_verification: catalogue, evidence và approved profile skill | 2026-10-12T19:33:40.175Z / `mobile-1791833620175-lnr1a1sx` |
| POST | `/api/student-verifications` | 201 | Hồ sơ → Xác minh sinh viên | FR-002, FR-019 | student_verification: documents và verification status | 2026-10-12T19:30:38.563Z / `mobile-1791833438563-bwpn2d8f` |
| POST | `/api/student-verifications/documents` | 201 | Hồ sơ → Xác minh sinh viên | FR-002, FR-019 | student_verification: documents và verification status | 2026-10-12T19:30:38.444Z / `mobile-1791833438444-71t2vfkp` |
| POST | `/api/wallet/top-ups` | 201 | Ví → Lịch sử / Nạp tiền | FR-008, FR-010 | wallet_ledger: balance, topup intent và ledger | 2026-10-12T19:26:16.656Z / `mobile-1791833176656-ubild99a` |

## Dữ liệu và scenario quan sát trực tiếp

- Dashboard: learner/teacher/poor/upload đọc số dư và xác minh khác nhau; session restore sau restart; offline hiện error/retry; refresh sau nghiệp vụ. Mobile auth refresh 200 đã quan sát với TTL tạm 20s và đã khôi phục cấu hình bình thường.
- Booking: learner và poor đi từ Detail → Pending → Confirmed qua UI. Đã sửa trạng thái settlement/backoff; một POST confirm, sau đó GET reconcile. Thiếu tiền được UI chặn xác nhận; không suy ra đã chạy rejection debit thiếu tiền trên server.
- Ledger: lớp 100 credit debit learner 100, teacher pending 90, fee 10. Hai lớp push riêng đã hủy và hoàn learner 100 mỗi lớp đúng một lần. Repeat cancel409. Replay event cancellation `778644f6-3506-488f-9949-5693afd5d1ac` bằng RabbitPublisher giữ nguyên identity: inbox1, logical delivery1, refund1 trước/sau; không gửi thêm push logical.
- Class: tạo qua UI lớp `d5278968-6588-4a82-9d38-09adbb409291`, bắt đầu sau >=48h. Lớp edit fixture sửa 80→85 rồi hủy qua UI. Lớp Confirmed PATCH trả409 và hiện lỗi. Learner thao tác sửa/hủy lớp teacher bằng công cụ ops trả403; thao tác ops không tính mobile route.
- Upload: chọn checkpoint PDF từ Android Download, PUT MinIO 5.822 bytes, submit rồi admin approve; mobile refresh thấy approved. SHA256 nguồn và object đọc lại cùng `df2a79ec0e7c860575c205cd6ee32bf00185f202414152199eeadee57632f9ac`. Verification `097f3362-19a3-47d7-9947-bbd3c02d5bca`; document `184cbca2-cc02-430b-b428-636f81663c0f`. Picker cancel đã quan sát; upload failure/retry bổ sung ở mục negative probes.
- Skill: upload account submit mô tả Python intermediate; verifier claim/approve qua ops; mobile history “Trung cấp · Đã duyệt”. Evidence `1f15942b-051f-42e8-a29c-7bc5c909db3b`.
- Push: backend cancellation → inbox/delivery → Expo ticket/receipt → Android remote notification trong notification tray → tap mở lịch và reload theo learner. Receipt ok là kết quả provider. Heads-up tiếng Việt đã capture trên APK ARM64 preview. Cold start sau fix: pid không tồn tại trước teacher cancel; remote push nhận; tap mở Lịch của tôi, Khác hiện cancelled. Lượt lớp204 có debit100/pending90/fee10/refund100, receiptok. Development launcher vẫn phụ thuộc Metro; dùng preview APK cho cold start demo.
- Ngôn ngữ: Cài đặt đổi vi→en→vi cập nhật subscription tương ứng; remote cancellation thật đã nhận tiêu đề “Lớp học đã hủy”, nội dung tiếng Việt và tap đúng lịch. Inbox dịch theo locale UI. Thông báo đã hiện trước khi đổi ngôn ngữ không tự đổi chữ.

Bảy nhóm resources đã được sử dụng: Account, Class, Booking, Wallet/Ledger, StudentVerification, Skill/Evidence, Notification/Device.

## Artifacts và giới hạn

Thư mục evidence ở Downloads chứa snapshot database trước acceptance và trước migration, log request JSONL, PDF readback, screenshots/video. Không commit database dump hoặc credentials. `booking-success.mp4` là video booking sau fix. `booking.mp4`, `push-open.mp4` và các ảnh push2 ban đầu có lỗi runtime, không dùng làm bằng chứng pass.

Full `pnpm verify` sau locale fix xanh: mobile208 tests/27 suites; API569 tests/107 suites; arch exit0 còn warning orphan có sẵn. `git diff --check` xanh. E2E payment/upload trên DB test riêng pass6/6, exit0 không forceExit; còn log lỗi đóng kết nối trong teardown; Jitsi/reminder/rating/iPhone ngoài phạm vi.

**Các điều kiện checkpoint chính đã có evidence**: ba flow, 7 resources, 26 APIs, MinIO bytes match, remote push banner/tap/refund. APK ARM64 có JS đã build/cài. Hai diễn tập liên tục đầy đủ và các negative probes còn được theo dõi riêng; không suy ra chúng từ các scenario rời.


## APK và cold start sau fix

`skillswap-week6-arm64-preview.apk` (~41MB), ARM64, JS bundled, local debug signing chỉ dành cho demo; cài thành công và gọi Gateway qua adb reverse4000 mà không dùng Metro. `skillswap-week6-development.apk` (~248MB) giữ riêng và dùng Metro. Hash tại `apk-sha256.txt` cùng thư mục Downloads evidence.

Evidence mới: `push-preview-heads-up-vi.png`, `push-preview-tray-vi.png`, `push-preview-coldstart-schedule.png`, `push-preview-cancelled.png`, `push-preview-coldstart-success.mp4`. `push-preview-open-before-routing-fix.mp4` là lượt lỗi trước fix, không phải bằng chứng pass. Code tại commit `67d6419`/`c483bc6` đã trong preview; root pending notification chờ auth/index Redirect kết thúc.

Graphify code graph cập nhật: 8.551 nodes / 18.578 edges; extractor không thay thế nghiệm thu runtime. Các thay đổi docs semantic chưa được CLI code-update tái trích xuất.


Lớp mới từ UI sau diễn tập: `58baa38e-588e-4216-9367-acf7d77ac868` (Python push English), `3c7c0afe-350f-4bda-9d65-37825b03b90c` (Python demo live). Cả hai bắt đầu sau72h; lớp demo live sửa100→110 qua PATCH/readback rồi100, để dành cho demo. Screenshot `teaching-edit-persisted.png` ghi110 trước khi đưa về100.


## Ngôn ngữ và hai lượt booking/push trên APK cuối

- Tiếng Việt: lớp204, booking `b5abbed8-7f93-4816-9e25-aa7456a2df9a`; trước cancel tiến trình app không tồn tại; remote notification, tap cold start mở Lịch của tôi; ledger100/90/10/refund100, receiptok.
- English: lớp`58baa38e-588e-4216-9367-acf7d77ac868`, booking`d10ba603-4ddb-4479-9fcd-d1619d29bbf2`; teacher tạo qua UI, learner search/detail/hold/confirm qua UI. Đổi English → subscriptionen → tắt tiến trình → teacher cancelAPI → “Class canceled”/English body → tap vào My Schedule sau restart, localeen được giữ; ledger100/90/10/refund100. Ảnh `settings-english.png`, `push-tray-en-expanded.png`, `push-coldstart-en-schedule.png`.
- `mobile-final-rehearsal.mp4` là video bổ trợ một phần thao tác; không phải video bao trọn cả hai lượt liên tục. Hai lượt booking/push đã chạy trên APK cuối; chưa có hai video diễn tập toàn bộ Dashboard/Resource/Upload liên tục.
- Request evidence hiện306 requests, vẫn26 templates. Khi tiếp tục diễn tập, số request tăng nhưng không tăng số API unique.

## Các negative probes còn giới hạn

Mobile upload failure/retry và từ chối quyền push đã nghiệm thu như bên dưới; adapter/lifecycle tests pass. E2E S3 có6/6 tests cùng booking suite không skip. Foreground notification handler có code/tests, chưa có video riêng chứng minh banner foreground. Các lượt warm background/cold start đã quan sát trực tiếp. Reminder/Jitsi/rating/iPhone ngoài scope.


## Negative probes bổ sung và trạng thái demo cuối

- Runtime account `ae8a8def-1b67-4917-8923-e9c20fc5ab2f`: Android chọn PDF, tắt adb reverse9000 → lỗi upload/retry. DB có slot document pending `060234a6-d18b-49e0-9a00-c8ac71df5a0c` nhưng **0 đơn verification**. Khôi phục9000 và retry → document `d9e19154-cfda-43eb-9399-2c0a7e547858` attached, đúng1 verification `edb94bc9-44ad-471a-a8aa-7625677022f4`. Readback5.822 bytes, SHA256 giống PDF nguồn; admin approve thực. Ảnh `upload-network-failure.png`, file `upload-retry-readback.pdf`.
- Android dùng system document picker, không yêu cầu quyền đọc toàn bộ thư viện; đã kiểm tra cancel picker. Không dựng một permission prompt không tồn tại cho file.
- Tắt device push, revoke POST_NOTIFICATIONS, mở lại app và bấm enable → chọn “Don’t allow” trong dialog Android. Device inactive; inbox vẫn GET thành công và hiển thị1 kết quả verification bằng tiếng Việt sau admin approve. Ảnh `inbox-with-push-denied.png`. Đã grant lại quyền và enable push để tiếp tục demo.
- Foreground: gửi **thông báo hạ tầng thử** qua ExpoPushProvider khi MainActivity đang topResumed; Android tạo notification “Kiểm tra thông báo”, app vẫn mở. Đây không tính là push nghiệp vụ, và ảnh `push-foreground-test.png` chỉ capture icon/trạng thái app, không chứng minh heads-up foreground. Hai cancellation scenario background/cold start ở trên mới là bằng chứng nghiệp vụ.
- Giữ lớp `3c7c0afe-350f-4bda-9d65-37825b03b90c` published100, bắt đầu16/10; poor đặt lớp này thật để về20 credits, teacher pending90. Learner vẫn500 credits và chưa đặt lớp demo, còn chỗ cho Main Business Flow. Không chỉnh tay số dư.
- App được trả về learner, localevi, push đã bật. Provider mock, callback, thao tác admin/verifier/cancel qua Mac được công bố và không tính vào mobile26 APIs.

Không tuyên bố video bao trọn hai diễn tập toàn bộ các thao tác; đã có hai lượt booking/push với hai lớp trên APK cuối, Resource create/edit/cancel và upload được nghiệm thu riêng. Main conditions có evidence; giới hạn video/foreground heads-up được giữ rõ để không suy ra từ receipt/unit tests.
