# Plan mobile SkillSwap — phạm vi rubric 20%

Ngày: 12/10/2026. Trạng thái: 30 endpoint API đã được nối vào mobile UI; Antigravity hết quota ở lát trước, Codex tiếp tục triển khai và kiểm tra.

## 1. Mục tiêu và giả định

Xây dựng app Expo/React Native tại `apps/mobile`, dùng backend hiện có qua Gateway, đáp ứng: ≥5 resources, 20–30 APIs, push notification, dashboard và major business flows. Chọn **30 endpoints nghiệp vụ được app sử dụng**, **8 resources**, dashboard học/dạy và 5 kịch bản demo hoàn chỉnh.

Giả định resources là đối tượng nghiệp vụ có dữ liệu/API/màn hình; API được đếm theo cặp HTTP method + route template. Đây là cách diễn giải rubric được cung cấp, chưa phải xác nhận của giảng viên. Không coi 5 resources đồng nghĩa 5 bộ CRUD: booking và ledger phải giữ state machine/immutability.

iPhone (iOS) là nền tảng nghiệm thu ưu tiên hàng đầu; duy trì khả năng chạy và kiểm thử trên Android, chưa bao gồm phát hành store. Người dùng chưa có Apple Developer/EAS; push thật và video trên thiết bị vẫn chưa được nghiệm thu. Ước lượng 4–6 tuần ban đầu không phải lịch thực tế đã xác nhận.

## 2. Căn cứ hiện tại

Đã đối chiếu ARCHITECTURE.md, PRODUCT.md, DESIGN.md, SRS, ADR-013/014/015/017/019/020/021/030, ADR-031 và controller hiện tại.

- Mobile dùng Expo + Expo Router với HTTP integration qua Gateway, session an toàn, dashboard learner, marketplace, lịch, ví, xác minh, kỹ năng, teaching, room access, rating và notifications.
- 30/30 method + route template trong ma trận có backend handler, contract, mobile adapter và caller UI. `tasks/todo.md` ghi rõ phần native/runtime acceptance còn mở.
- Top-up dùng mock provider (ADR-017); có callback HMAC nhưng URL mock chưa chứng minh checkout thật. Luồng demo cần mock-provider harness phía server, tuyệt đối không đưa HMAC secret vào app.
- Jitsi có quyết định self-hosted JWT (ADR-020); endpoint room access tồn tại không chứng minh cuộc gọi trên điện thoại hoạt động. Cần spike mạng/TLS/mic/camera sớm.
- Inbox bền vững và APIs đăng ký/hủy thiết bị đã có; một số sự kiện xác minh/booking/wallet được ghi vào inbox. Push dispatcher gửi token tới Expo, receipt retry/invalidation và class-start reminder chưa được triển khai; không tính phần này là nghiệm thu push.
- Role là `user | verifier | admin` (ADR-030). Cùng một `user` học và dạy; khả năng dạy phụ thuộc xác minh và approved skills. Không tạo role teacher/learner.

Các nhận định trên là kiểm tra source, chưa chạy backend/devices hoặc `pnpm verify` trong bước lập plan.

## 3. Phạm vi và resources

| Resource | Chức năng mobile | Căn cứ |
|---|---|---|
| Account | Đăng ký/đăng nhập/session/thông tin tài khoản | FR-001, FR-017 |
| StudentVerification | Upload, nộp, xem trạng thái/lý do, nộp lại | FR-002, FR-019 |
| Skill / SkillEvidence | Chọn skill, nộp bằng chứng mô tả, xem level/lịch sử | FR-003, FR-018, ADR-026 |
| Class | Tìm kiếm/chi tiết/đăng/sửa/hủy/bắt đầu/kết thúc | FR-005, FR-006, FR-020 |
| Booking | Đặt/confirm/lịch cá nhân/vào phòng | FR-007, FR-009, FR-011 |
| Wallet / LedgerTransaction | Số dư, top-up, lịch sử, pending income | FR-008, FR-010 |
| Rating | Một rating/comment cho mỗi booking hợp lệ | FR-013 |
| Notification / DeviceSubscription | Inbox, push, đăng ký/hủy token | FR-016 + rubric mobile |

Ngay cả bỏ Account/Notification khỏi cách chấm, vẫn có 6 nhóm nghiệp vụ còn lại. Tách cụ thể Skill và SkillEvidence trong evidence matrix nếu giảng viên đếm theo entity.

Phạm vi này phục vụ người học/người dạy. Admin/Verifier duyệt qua công cụ vận hành/web được xác thực; cần tài khoản seed và thao tác duyệt thực trong demo. Chưa bao gồm mobile dashboard quản trị FR-015, rút tiền FR-014, chat riêng FR-012, và phát hành store. Đây là phạm vi đáp ứng rubric mobile, **không phải tuyên bố hoàn tất mọi FR của toàn SRS**. Nếu giảng viên coi rút tiền/chat là major flow bắt buộc, phải lập increment bổ sung và phân bổ lại ngân sách API.

Skill evidence dùng dạng capability recognition + description đã được contract hỗ trợ. Upload chứng chỉ skill cần storage adapter/route riêng khi mở rộng; không dùng URL upload giấy tờ sinh viên thay cho chứng chỉ skill.

## 4. Kiến trúc và giao diện

`Mobile → HTTPS Gateway → API modules → PostgreSQL / outbox → RabbitMQ → notification consumer → Expo Push Service → FCM/APNs → điện thoại`.

- Giữ ADR-015: Expo/React Native/TypeScript + Expo Router; dùng `@skillswap/contracts`, không import code từ web/api/gateway vào mobile.
- HTTP adapter triển khai application ports; session lưu qua secure storage, refresh token rotation có single-flight; idempotency key giữ nguyên khi retry booking. Không replay thao tác tiền một cách mù quáng.
- Chọn thư viện query/cache và native dependencies tương thích Expo đang khóa trong repo ở phase nền tảng; không nâng SDK chỉ để theo ví dụ mới.
- Luôn gọi Gateway; phone dùng hostname/IP reachable hoặc HTTPS staging, không dùng localhost của máy dev. Jitsi dùng hostname/TLS được phone tin cậy.
- Đã chốt ADR-031 và `tasks/mobile-contracts.md`: device subscriptions/inbox/push worker thuộc `account-profile`; lịch nhắc (offset 30 phút) thuộc `schedule`; đánh giá (rating) thuộc `live-class`; danh mục kỹ năng thuộc `skill-verification`. Giữ nguyên 7 schemas, không thêm notification schema/module. Broker access chỉ tại shared/messaging, TypeORM tại persistence adapters, không join SQL chéo schema.
- Thêm event schemas cần thiết (`class.reminder.due`, `wallet.transaction.completed`, `classId` trong `booking.confirmed`) đã được chốt chi tiết tại ADR-031.
- Tabs: **Trang chủ / Khám phá / Lịch của tôi / Ví / Hồ sơ**; chuông mở inbox. Khu Dạy học từ Trang chủ/Hồ sơ theo capability. Đây là lựa chọn UI trong plan, không phải role switch.
- Khoảng 15–18 màn: auth, dashboard, marketplace, class detail, booking confirmation, lịch/detail booking, room entry, wallet/history/top-up, student verification/status, skill submission/history, teaching list/create/edit, rating, inbox/settings.
- Theo DESIGN.md: slate + Campus Emerald, CTA pill, status text + màu, tap target ≥44 px, 360 px không tràn ngang, vi/en đồng bộ và không trộn trên một màn. Loading/empty/error/retry ở mọi màn dữ liệu.

## 5. Ngân sách 30 APIs

### Trạng thái triển khai đối chiếu source (12/10/2026)

Ma trận bên dưới là phạm vi đích, không tự nó chứng minh hoàn tất. Tại checkpoint 12/10/2026, **30/30 method+route duy nhất** có backend handler, contract, mobile adapter, caller UI và focused test: auth (5), student verification (3), skills/evidence/catalogue (4), class browse/detail + teaching lifecycle (7), booking reserve/confirm/my schedule/room access (4), wallet (3), rating (1), inbox/device subscriptions (3). `pnpm verify` xanh. Hai migration rating và notification đã áp dụng thành công trên database development local; không áp dụng staging/production. E2E sau migration: booking-flow pass, publish-gate còn fail do không chờ được trạng thái xác minh mong đợi; vì vậy runtime acceptance chưa hoàn tất. Push thật và nghiệm thu thiết bị vẫn còn mở.

| Phần nghiệm thu còn mở (không làm giảm số API code-complete) | Backend/mobile code | Evidence | Trạng thái |
|---|---|---|---|
| POST `/classes/bookings/:bookingId/rating` runtime | Đã có | Đã có form/API | Migration áp dụng local; cần E2E thành công |
| GET `/notifications`, device POST/DELETE | Đã có; inbox consumers xử lý verification/booking/wallet | UI inbox, đăng ký/gỡ token | Migration áp dụng local; cần E2E kiểm tra database |
| Remote push trên iPhone | Token API và permission flow đã có | Đăng ký token từ UI | Blocked acceptance: thiếu EAS/Apple Developer và thiết bị build |
| Native flows (upload, Jitsi, 360px) | Code paths đã có | Chưa đủ bằng chứng thiết bị | Còn mở; cần staging/runtime và device test |

Các route có caller nhưng chưa chứng minh phone/runtime acceptance riêng: document-storage thật, classroom/Jitsi trên iPhone, dashboard dạy trên seed data; các tiêu chí này vẫn nằm trong checklist nghiệm thu thiết bị.

Các phase đã thực hiện theo commit riêng; phần code còn lại ngoài mục tiêu 30 API:

1. **API foundation, student/skill, teaching, learning, notification endpoints** — đã code/test/commit; 30 unique paths được gọi từ các luồng mobile.
2. **Push dispatch + receipt lifecycle** — còn mở, không được thay bằng mock-only.
3. **Acceptance** — migrations đã áp dụng trên database development local; sửa/điều tra E2E publish-gate, chạy lại E2E và hoàn tất native phone checks khi có credentials phù hợp.

Acceptance mỗi API: (a) method+route được đối chiếu ở Gateway/API; (b) mobile adapter parse contract; (c) caller UI trong luồng nghiệp vụ; (d) focused tests cho contract/ownership/error; (e) status matrix cập nhật. Push thiết bị thật là acceptance riêng và chưa hoàn tất.

Tất cả đường dẫn dưới đây có prefix `/api`; “Có” nghĩa là đã thấy controller, **không có nghĩa app đã tích hợp/endpoint đã nghiệm thu runtime**. “Mới” là route đề xuất, tên/body sẽ chốt bằng contract ở phase 0.

| # | Method + path | App dùng để | Source | FR |
|---|---|---|---|---|
| 01 | POST /auth/register | Đăng ký user | Có | 001 |
| 02 | POST /auth/login | Đăng nhập | Có | 001 |
| 03 | POST /auth/refresh | Refresh session | Có | 001 |
| 04 | POST /auth/logout | Đăng xuất/revoke session | Có | 001 |
| 05 | GET /auth/me | Account/trust summary | Có | 001,017 |
| 06 | POST /student-verifications/documents | Xin upload target | Có | 002 |
| 07 | POST /student-verifications | Nộp/nộp lại xác minh | Có | 002,019 |
| 08 | GET /student-verifications/me | Trạng thái/lý do | Có | 017,019 |
| 09 | GET /skills | Catalogue skill/level | Mới | 003,006 |
| 10 | POST /skill-evidence | Nộp bằng chứng mô tả | Có | 003 |
| 11 | GET /profile-skills/me | Level và quyền dạy | Có | 003,005 |
| 12 | GET /skill-evidence/:id/history | Lịch sử quyết định | Có | 018 |
| 13 | GET /classes | Marketplace hoặc lớp tôi dạy | Mới | 005,006 |
| 14 | GET /classes/:id | Chi tiết lớp/Teacher công khai | Mới | 006 |
| 15 | POST /classes | Tạo và publish (route hiện có) | Có | 005 |
| 16 | PATCH /classes/:id | Sửa trước khóa cam kết | Có | 005,007 |
| 17 | POST /classes/:id/cancel | Teacher hủy lớp | Có | 007 |
| 18 | POST /classes/:id/start | Bắt đầu dạy | Có | 020 |
| 19 | POST /classes/:id/complete | Kết thúc dạy | Có | 020 |
| 20 | POST /classes/:id/bookings | Giữ chỗ Pending | Có | 007 |
| 21 | POST /classes/bookings/:bookingId/confirm | Confirm/settlement | Có | 009 |
| 22 | GET /classes/bookings/me | Lịch học, trạng thái/reconciliation | Mới | 007,011,020 |
| 23 | POST /classes/bookings/:bookingId/room-access | JWT/URL vào phòng | Có | 011 |
| 24 | POST /wallet/top-ups | Tạo top-up intent | Có | 008 |
| 25 | GET /wallet/balance | Available/pending | Có | 010 |
| 26 | GET /wallet/history | Giao dịch + pagination | Có | 010 |
| 27 | POST /classes/bookings/:bookingId/rating | Rating/comment một lần | Mới | 013 |
| 28 | GET /notifications | Inbox theo owner/cursor | Mới | 016 |
| 29 | POST /notification-devices | Upsert token thiết bị hiện tại | Mới | 016 |
| 30 | DELETE /notification-devices/:id | Tắt push/đăng xuất thiết bị | Mới | 016 |

**22 routes có controller + 8 routes mới = 30.** Không đếm health/status, payment webhook, URL PUT của storage, admin/verifier routes, hoặc 2 query của cùng route thành 2 API. Dashboard tổng hợp các API trên, không bắt buộc thêm `/dashboard` chỉ để tăng count.

Read contracts đã chốt tại ADR-031 và `tasks/mobile-contracts.md`:
- GET /skills: category, keyword, cursor; trả về danh mục chuẩn hóa.
- GET /classes: keyword tìm kiếm mô tả, skillId, khoảng thời gian (startDate/endDate), cursor; teacherId=me trả lớp mình dạy có kiểm tra owner; marketplace chỉ trả lớp published và trước giờ học ≥24h.
- GET /classes/:id: metadata, available seats, Teacher public summary, rating summary/list được phân trang phù hợp. Không lộ giấy tờ cá nhân.
- GET /classes/bookings/me: chỉ dữ liệu learner là caller, lọc trạng thái/upcoming và cursor; embed class summary + room/rating eligibility. Total upcoming count tính chính xác tại database.
- POST /classes/bookings/:bookingId/rating: đúng 1 lần cho booking confirmed của lớp completed, stars 1-5, comment.
- GET /notifications: inbox bền vững theo owner/cursor, unread count chính xác.
- POST /notification-devices và DELETE /notification-devices/:id: gắn và gỡ token theo account, hỗ trợ luồng đổi tài khoản trên thiết bị.
- Có test static routes `/classes/bookings/me` trước `/:id`, auth/ownership và pagination.

## 6. Dashboard và luồng nghiệm thu

Dashboard học: account/verification status + rejection reason, available credit, số lớp sắp học, lớp gần nhất, CTA vào lớp theo window. Dashboard dạy: trạng thái skill/level, lớp đang mở/sắp dạy, available + pending income, CTA mở lớp/hoàn tất xác minh. Tách số tiền có thể tiêu và tiền đang chờ; không gắn nhãn pending là thu nhập đã nhận.

| Luồng | Các bước | Tiêu chí nghiệm thu |
|---|---|---|
| 1. Onboarding/xác minh | Register → upload ID → submit → admin duyệt → status/push | Lưu backend; upload thật; rejection và nộp lại chạy được |
| 2. Học/booking | Search → detail → top-up mock-provider → Pending → confirm → lịch/dashboard | Đủ 24h, capacity, không tự book, không double debit; Pending chưa khẳng định đã trả tiền |
| 3. Dạy học | Submit evidence → verifier claim/approve → create → edit → start/complete | Quyền dạy kiểm tra ở server; edit-lock sau Confirmed; release quan sát qua wallet |
| 4. Tham gia/rating | Lịch → authorized room → Jitsi → class completed → rating | Hai thiết bị vào cùng phòng, mic/camera được; outsider/window denied; rating đúng một lần |
| 5. Hủy/hoàn/thông báo | Teacher cancel → learner push → booking cancelled → wallet refund | UI chờ ledger cập nhật; full refund credit đúng một lần; không có nút learner tự hủy |

Ví dụ đối soát: nạp 100.000 VND → 100 credit; lớp 100 credit → debit learner 100, teacher pending 90, platform fee 10. Release chỉ khi completion đủ điều kiện; cancel trước completion hoàn 100 credit theo policy. Theo dõi downstream outbox bằng polling bounded/backoff + refresh; response command không chứng minh ledger đã post.

## 7. Push notification

Chọn Expo Notifications + Expo Push Service để dùng cùng stack hiện có. Development build là yêu cầu cho remote push; nghiệm thu ưu tiên hàng đầu trên iPhone (iOS), đồng thời duy trì trên Android. FCM/APNs credentials cần sẵn; nếu chưa có credentials hoặc thiết bị thật, ghi nhận là incomplete ngoại vi, không thay bằng mock-only. Căn cứ: [Expo setup](https://docs.expo.dev/push-notifications/push-notifications-setup/) và [Expo notification concepts](https://docs.expo.dev/push-notifications/what-you-need-to-know/).

- Xin permission có ngữ cảnh; từ chối vẫn dùng app và inbox được. Register token theo account + installation, token rotation/upsert; logout hủy association để máy chung không nhận thông báo của user cũ.
- Nghiệp vụ tạo inbox record trước dispatch; source transaction + outbox/durable handoff, consumer dedup theo event/user; reminder dedup class/user/time offset. Offset đã chốt chính xác 30 phút theo ADR-031.
- Base scope: verification outcome, confirmed/cancelled booking, starting soon, completed wallet transaction. Withdrawal outcome chỉ thêm khi FR-014 triển khai.
- Sender async có retry/backoff, ticket/receipt tracking và vô hiệu token `DeviceNotRegistered`. Broker truy cập qua shared/messaging; Expo/vendor SDK ở adapter. [Expo sending/receipts](https://docs.expo.dev/push-notifications/sending-notifications/).
- Payload tối thiểu notificationId + loại target + id; không chứa giấy tờ, token room hay thông tin tài chính nhạy cảm trên lock screen. App mở deep link sau auth và fetch lại quyền/trạng thái.
- Nghiệm thu foreground/background/cold start, permission denied, logout/relogin, event retry, reminder sau cancel. Cold start không có nghĩa mọi trạng thái force-stop của OS đều nhận được push.
- Ticket/receipt thành công chỉ chứng minh provider xử lý/chuyển tiếp; evidence demo cần thấy thông báo trên điện thoại và tap mở đúng booking/class.

## 8. Phases, commit và checkpoint

Mỗi phase là một meaningful commit có body giải thích vì sao; chỉ commit files của phase, giữ các thay đổi đang có trong repo. Nếu phase lớn cần task commits riêng, vẫn giữ ranh giới phase rõ ràng. Danh sách task và AC cụ thể nằm ở `tasks/todo.md`.

| Phase | Thời lượng ước lượng | Kết quả | Commit đề xuất |
|---|---|---|---|
| 0. Chốt contract/rủi ro | 2–3 ngày | Resource/API matrix, ADR-031 mobile delivery contracts, search filters, rating eligibility, push+Jitsi spike | docs(mobile): define rubric delivery scope |
| 1. Session + app shell | 3–4 ngày | Auth thật, secure storage, tabs, refresh, dashboard account/wallet ban đầu | feat(mobile): integrate authenticated app shell |
| 2. Marketplace + booking + ví | 5–7 ngày | Read APIs, tìm lớp, đặt/confirm, top-up harness, lịch, lịch sử/đối soát | feat(mobile): deliver learner booking flow |
| 3. Verification + dạy học | 4–6 ngày | Upload sinh viên, evidence description/history/catalogue, publish/edit/cancel, dashboard dạy | feat(mobile): deliver verified teaching flow |
| 4. Jitsi + completion + rating | 3–5 ngày | Vào lớp, start/complete, ledger release, rating thật | feat(mobile): deliver classroom and rating flow |
| 5. Inbox + push | 3–5 ngày | Device APIs, inbox, sender/events/reminders, deep links và device evidence | feat(mobile): deliver business push notifications |
| 6. Nghiệm thu/build | 2–3 ngày | 30 API evidence, ≥5 resources, regression, iPhone/Android installable build, demo | test(mobile): verify rubric acceptance flows |

Tổng khoảng 22–33 ngày làm việc theo luồng tuần tự; 4–6 tuần là mục tiêu khi chia việc hợp lý và có sẵn môi trường. Không hứa thời gian này khi chỉ một người hoặc chưa có hạ tầng.

Checkpoint mỗi phase: focused tests cho behavior đổi + build/typecheck/architecture; `pnpm verify` trước đóng phase code và trước tuyên bố hoàn tất. Sau code chạy `graphify update .`. Full gate không thay thế test trên thiết bị.

## 9. Rủi ro, scope mở và evidence

| Rủi ro | Hướng xử lý |
|---|---|
| Push optional trong SRS, rubric bắt buộc | Document scope và ADR trước code; FR-016 vẫn giữ stable ID |
| Resource/API cách đếm chưa được giải thích | Dùng 30 method+route và entity matrix; xác minh rubric trước tăng CRUD |
| Credentials/mạng/TLS/Jitsi fail cuối kỳ | Spike phase 0, device build sớm; tiêu chí live call rõ |
| Top-up mock URL chưa có checkout chạy được | Server-only harness có HMAC; ghi rõ mô phỏng; real provider là increment riêng |
| Notification boundary / event thiếu | ADR ownership và contracts trước consumer, giữ 7-schema rule |
| Dashboard count sai vì pagination | Aggregate tại data owner; không lấy length của trang đầu |
| Publish response không khớp read model | Kiểm tra contract/source; expose approved skill/Teacher public fields qua read projection |
| Async wallet chưa settle | UI processing + bounded polling + reconciliation; không báo paid chỉ từ POST |
| Upload target adapter có thể chỉ stub | Nghiệm thu file bytes persisted/authorized storage, không chỉ trả documentId |
| Jitsi room access hiện gắn booking | Spike Teacher entry có/không booking; không tự invent unauthenticated room route |

Evidence cuối: APK/install link, commit SHAs, API matrix request/response thực (che secrets), ≥5 resources có data persisted và màn hình, dashboard data thay đổi theo nghiệp vụ, video push nhận trên máy + deep link, video 5 flows, `pnpm verify` output. API chưa gọi bởi app hoặc demo mock-only không được đánh dấu tích hợp thật.

## 10. Các thông tin còn cần chốt khi bắt đầu build

Deadline/team; Android hay cả iOS; định nghĩa CRUD/resources của giảng viên; có bắt buộc chat/withdrawal/admin mobile không; real payment hay mock chấp nhận; domain staging/Jitsi, push credentials và nơi lưu upload. Plan dùng các giả định ở §1 để có thể review ngay, chưa phụ thuộc trả lời để hoàn thành bước lập kế hoạch.
