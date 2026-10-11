# Mobile Rubric — Concrete API Contracts & Delivery Specifications

Tài liệu đặc tả hợp đồng dữ liệu (data contracts), phân quyền (authorization), phân trang (pagination), mô hình chiếu dữ liệu (read projections), và luồng xử lý thông báo bền vững (durable notification pipeline) cho 8 API bổ sung trong ma trận 30 API của SkillSwap Mobile Client (ADR-015, ADR-031).

---

## 1. Kiến trúc Bounded Context & 7 Schemas

Theo `ARCHITECTURE.md` (ADR-005, ADR-007, ADR-014), toàn bộ hệ thống duy trì **đúng 7 schemas** thuộc 7 bounded context, kết nối qua TypeORM với credential độc lập cho từng module. Không tạo module hay schema thứ 8.

| Module | Database Schema | Phụ trách trong phạm vi Mobile |
|---|---|---|
| `account-profile` | `account_profile` | Auth session, hồ sơ cá nhân, **thiết bị push (`notification_devices`)**, **hộp thư (`inbox_notifications`)**, durable push dispatch worker. |
| `student-verification` | `student_verification` | Tải lên giấy tờ, nộp đơn xác minh sinh viên, trạng thái/lý do từ chối. |
| `skill-verification` | `skill_verification` | **Danh mục kỹ năng (`GET /skills`)**, nộp bằng chứng mô tả năng lực, kiểm tra quyền dạy/cấp độ (`profile-skills/me`). |
| `live-class` | `live_class` | Tạo/sửa/hủy/bắt đầu/kết thúc lớp, **tìm kiếm marketplace (`GET /classes`)**, **chi tiết lớp (`GET /classes/:id`)**, **lịch học của tôi (`GET /classes/bookings/me`)**, **đánh giá sau buổi học (`POST /classes/bookings/:bookingId/rating`)**. |
| `wallet-ledger` | `wallet_ledger` | Số dư credit, nạp tiền (mock provider HMAC), lịch sử giao dịch ledger, giải ngân thu nhập. |
| `schedule` | `schedule` | Quản lý lịch biểu, **job quét nhắc nhở trước giờ học 30 phút (`class.reminder.due`)**. |
| `admin-operation` | `admin_operation` | Quản trị viên phê duyệt xác minh, kiểm soát verifier (phía web/ops). |

---

## 2. Đặc tả 8 API bổ sung (Missing Routes Design)

Tất cả các route đều có tiền tố `/api`. Gateway xác thực Bearer JWT và gắn trusted headers (`x-user-id`, `x-user-email`, `x-user-role`).

### 2.1 Route 09: `GET /api/skills` — Danh mục kỹ năng (Skill Catalogue)
- **Module sở hữu**: `skill-verification`
- **Mục đích**: Người dùng/giảng viên duyệt danh mục kỹ năng chuẩn hóa (theo 2 cấp category -> skill) để nộp bằng chứng hoặc lọc tìm kiếm lớp học.
- **Xác thực**: Authenticated; this mobile increment starts browsing after login.
- **Query parameters**:
  ```ts
  export const listSkillsQuerySchema = z.object({
    category: z.string().min(1).optional(),
    keyword: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().min(1).optional(),
  });
  ```
- **Response (`200 OK`)**:
  ```ts
  export const skillCataloguePageSchema = z.object({
    items: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        category: z.string().min(1),
      })
    ),
    nextCursor: z.string().nullable(),
  });
  ```
- **Xử lý dữ liệu**: Query trực tiếp bảng `skills` trong schema `skill_verification`. Phân trang keyset theo `id` hoặc category+name.

---

### 2.2 Route 13: `GET /api/classes` — Tìm kiếm Marketplace & Lớp tôi dạy
- **Module sở hữu**: `live-class`
- **Mục đích**: 
  1. *Chế độ Marketplace:* Học viên tìm kiếm lớp học mở có sẵn để đăng ký. Chỉ trả về các lớp ở trạng thái `published` và có `starts_at >= NOW() + 24 hours` (thỏa mãn SR-BR-004 đặt trước 24h).
  2. *Chế độ Lớp tôi dạy (`teacherId=me`):* Giảng viên xem toàn bộ danh sách lớp mình đã tạo (`published`, `in_progress`, `completed`, `cancelled`) kèm số lượng đặt chỗ và doanh thu dự kiến.
- **Xác thực**:
  - Marketplace browse: Authenticated.
  - Khi `teacherId=me`: Bắt buộc Authenticated (kiểm tra `x-user-id`). Nếu caller không trùng khớp -> `403 Forbidden`.
- **Query parameters**:
  ```ts
  export const listClassesQuerySchema = z.object({
    keyword: z.string().min(1).optional(),
    skillId: z.string().min(1).optional(),
    startDate: z.string().datetime({ offset: true }).optional(),
    endDate: z.string().datetime({ offset: true }).optional(),
    teacherId: z.string().min(1).optional(), // 'me' hoặc UUID cụ thể
    state: z.enum(['published', 'in_progress', 'completed', 'cancelled']).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).optional(),
  });
  ```
- **Response (`200 OK`)**:
  ```ts
  export const classListItemSchema = z.object({
    id: z.string().min(1),
    teacherId: z.string().min(1),
    teacherDisplayName: z.string().min(1),
    skillIds: z.array(z.string().min(1)),
    description: z.string().min(1),
    startsAt: z.string().datetime({ offset: true }),
    durationMinutes: z.number().int(),
    priceCredits: z.number().int().positive(),
    capacity: z.number().int().positive(),
    confirmedBookingsCount: z.number().int().nonnegative(),
    availableSeats: z.number().int().nonnegative(),
    state: z.string().min(1),
    averageRating: z.number().min(0).max(5).nullable(),
    ratingsCount: z.number().int().nonnegative(),
  });

  export const listClassesPageSchema = z.object({
    items: z.array(classListItemSchema),
    nextCursor: z.string().nullable(),
    totalActiveTeachingCount: z.number().int().nonnegative().optional(), // Chỉ trả về khi teacherId='me'
  });
  ```
- **Read Projection**:
  - `teacherDisplayName` được lấy từ local projection `live_class.teacher_profiles` (cập nhật qua integration event tài khoản hoặc cache public profile). Tuyệt đối không JOIN sang schema `account_profile`.
  - `availableSeats` = `capacity - confirmedBookingsCount`.

---

### 2.3 Route 14: `GET /api/classes/:id` — Chi tiết lớp học
- **Module sở hữu**: `live-class`
- **Mục đích**: Hiển thị đầy đủ thông tin chi tiết lớp, thông tin giáo viên công khai, đánh giá gần nhất, và tính toán tính đủ điều kiện đặt chỗ (`canBook`).
- **Xác thực**: Public hoặc Authenticated (nếu có token, tính toán thêm trạng thái đã đặt chỗ của caller).
- **Response (`200 OK`)**:
  ```ts
  export const classDetailViewSchema = z.object({
    id: z.string().min(1),
    teacher: z.object({
      id: z.string().min(1),
      displayName: z.string().min(1),
      averageRating: z.number().min(0).max(5).nullable(),
      ratingsCount: z.number().int().nonnegative(),
    }),
    skillIds: z.array(z.string().min(1)),
    description: z.string().min(1),
    startsAt: z.string().datetime({ offset: true }),
    durationMinutes: z.number().int(),
    priceCredits: z.number().int().positive(),
    capacity: z.number().int().positive(),
    availableSeats: z.number().int().nonnegative(),
    state: z.string().min(1),
    canBook: z.boolean(), // true nếu state=published, availableSeats > 0, startsAt >= now + 24h, và caller != teacher
    recentRatings: z.array(
      z.object({
        id: z.string().min(1),
        learnerDisplayName: z.string().min(1),
        stars: z.number().int().min(1).max(5),
        comment: z.string().min(1),
        createdAt: z.string().datetime({ offset: true }),
      })
    ),
  });
  ```
- **Bảo mật**: Không bao giờ trả về giấy tờ sinh viên, email cá nhân hoặc tài liệu riêng tư của giáo viên.

---

### 2.4 Route 22: `GET /api/classes/bookings/me` — Lịch học của tôi (Learner Bookings)
- **Module sở hữu**: `live-class`
- **Mục đích**: Học viên theo dõi các lượt giữ chỗ (pending), các buổi học đã xác nhận (confirmed), trạng thái vào phòng học Jitsi, và điều kiện đánh giá sau khi hoàn thành.
- **Xác thực**: Authenticated (bắt buộc, lọc nghiêm ngặt theo `learner_id = currentUserId(request)`).
- **Query parameters**:
  ```ts
  export const myBookingsQuerySchema = z.object({
    state: z.enum(['pending', 'confirmed', 'cancelled']).optional(),
    upcoming: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).optional(),
  });
  ```
- **Response (`200 OK`)**:
  ```ts
  export const learnerBookingItemSchema = z.object({
    bookingId: z.string().min(1),
    classId: z.string().min(1),
    state: z.enum(['pending', 'confirmed', 'cancelled']),
    priceCredits: z.number().int().positive(),
    createdAt: z.string().datetime({ offset: true }),
    classSummary: z.object({
      description: z.string().min(1),
      skillIds: z.array(z.string().min(1)),
      startsAt: z.string().datetime({ offset: true }),
      durationMinutes: z.number().int(),
      teacherId: z.string().min(1),
      teacherDisplayName: z.string().min(1),
      classState: z.string().min(1),
    }),
    roomAccessEligible: z.boolean(), // true nếu confirmed và trong cửa sổ [-openMinutes, +durationMinutes]
    ratingEligible: z.boolean(),     // true nếu class đã completed và chưa đánh giá
    hasRated: z.boolean(),
  });

  export const myBookingsPageSchema = z.object({
    items: z.array(learnerBookingItemSchema),
    nextCursor: z.string().nullable(),
    totalUpcomingCount: z.number().int().nonnegative(), // Exact count từ cơ sở dữ liệu
  });
  ```

---

### 2.5 Route 27: `POST /api/classes/bookings/:bookingId/rating` — Đánh giá buổi học
- **Module sở hữu**: `live-class` (Bảng `ratings` thuộc schema `live_class`).
- **Mục đích**: Học viên gửi đánh giá 1-5 sao và nhận xét sau khi lớp học kết thúc (FR-013, SR-BR-010).
- **Xác thực**: Authenticated (`learner_id` phải khớp với booking owner).
- **Request Body**:
  ```ts
  export const createRatingSchema = z.object({
    stars: z.number().int().min(1).max(5),
    comment: z.string().min(1).max(1000),
  });
  ```
- **Ràng buộc nghiệp vụ (Invariants)**:
  1. Booking phải thuộc quyền sở hữu của caller (`learner_id == callerId`).
  2. Booking phải ở trạng thái `confirmed`.
  3. Lớp học tương ứng phải ở trạng thái `completed` (không được thay bằng điều kiện thời gian kết thúc).
  4. Giảng viên không được tự đánh giá lớp của mình (SR-BR-010).
  5. Mỗi booking chỉ được đánh giá duy nhất **1 lần**: bảng `ratings` có ràng buộc `UNIQUE ("booking_id")`. Gọi lại sẽ nhận `409 Conflict`.
- **Response (`201 Created`)**:
  ```ts
  export const ratingViewSchema = z.object({
    id: z.string().min(1),
    bookingId: z.string().min(1),
    classId: z.string().min(1),
    stars: z.number().int().min(1).max(5),
    comment: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
  });
  ```
- **Sự kiện tích hợp**: Phát sinh event `class.rated` vào Transactional Outbox của `live-class` để cập nhật điểm trung bình của giảng viên.

---

### 2.6 Route 28: `GET /api/notifications` — Hộp thư thông báo (Inbox)
- **Module sở hữu**: `account-profile` (Bảng `inbox_notifications` thuộc schema `account_profile`).
- **Mục đích**: Xem danh sách thông báo nghiệp vụ được lưu trữ bền vững (FR-016).
- **Xác thực**: Authenticated (lọc theo `account_id = currentUserId(request)`).
- **Query parameters**:
  ```ts
  export const listNotificationsQuerySchema = z.object({
    unreadOnly: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().min(1).optional(),
  });
  ```
- **Response (`200 OK`)**:
  ```ts
  export const notificationItemSchema = z.object({
    id: z.string().min(1),
    type: z.enum([
      'verification_outcome',
      'booking_confirmed',
      'booking_cancelled',
      'class_starting_soon',
      'wallet_transaction',
      'withdrawal_outcome',
    ]),
    title: z.string().min(1),
    body: z.string().min(1),
    targetType: z.enum(['class', 'booking', 'wallet', 'verification']),
    targetId: z.string().min(1),
    read: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
  });

  export const notificationsPageSchema = z.object({
    items: z.array(notificationItemSchema),
    nextCursor: z.string().nullable(),
    unreadCount: z.number().int().nonnegative(), // Exact aggregate count
  });
  ```

---

### 2.7 Route 29: `POST /api/notification-devices` — Đăng ký thiết bị nhận Push
- **Module sở hữu**: `account-profile` (Bảng `notification_devices` thuộc schema `account_profile`).
- **Mục đích**: Lưu trữ push token (Expo Push Token, định tuyến đến APNs cho iOS / FCM cho Android).
- **Xác thực**: Authenticated.
- **Request Body**:
  ```ts
  export const upsertDeviceSchema = z.object({
    token: z.string().min(1),
    platform: z.enum(['ios', 'android', 'web']),
    installationId: z.string().min(1).max(128),
    appVersion: z.string().max(32).optional(),
  });
  ```
- **Invariants**:
  - Gắn chặt token với `account_id` hiện tại.
  - Xử lý đổi tài khoản trên cùng thiết bị: nếu `installationId` hoặc `token` đã tồn tại cho tài khoản cũ, cập nhật sang `account_id` mới.
  - Cập nhật `updated_at` và đánh dấu `is_active = true`.
- **Response (`200 OK`)**:
  ```ts
  export const deviceSubscriptionSchema = z.object({
    id: z.string().min(1),
    installationId: z.string().min(1),
    platform: z.enum(['ios', 'android', 'web']),
    isActive: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
  });
  ```

---

### 2.8 Route 30: `DELETE /api/notification-devices/:id` — Hủy đăng ký thiết bị (Logout/Opt-out)
- **Module sở hữu**: `account-profile`
- **Mục đích**: Xóa hoặc vô hiệu hóa thiết bị khi đăng xuất để ngăn rò rỉ thông báo sang người dùng tiếp theo trên cùng thiết bị.
- **Xác thực**: Authenticated (chỉ được xóa thiết bị có `account_id == currentUserId(request)`).
- **Response (`200 OK`)**:
  ```ts
  export const deleteDeviceResultSchema = z.object({
    success: z.literal(true),
  });
  ```

---

## 3. Bộ đếm Dashboard chính xác (Exact Dashboard Counters)

Tuyệt đối không đếm độ dài mảng trang đầu tiên trên Client (`items.length`). Mọi bộ đếm đều được tính toán bằng truy vấn `COUNT(*)` chính xác tại Data Owner.

### 3.1 Bảng điều khiển Học viên (Learner Dashboard)
1. **Trạng thái tài khoản & xác minh sinh viên (`accountStatus` + `rejectionReason`):**
   - Nguồn: `account-profile` (`GET /api/auth/me`).
   - Giá trị: `pending` | `approved` | `rejected` | `revoked` | `null`. Kèm lý do từ chối nếu có.
2. **Số dư khả dụng (`availableCredit`):**
   - Nguồn: `wallet-ledger` (`GET /api/wallet/balance`).
   - Giá trị: Dùng trực tiếp số nguyên availableCredits do API trả về; không chia lần nữa. 1 credit = 1.000 VND chỉ dùng để trình bày quy đổi.
3. **Số lớp sắp học (`upcomingClassesCount`):**
   - Nguồn: `live-class` (`GET /api/classes/bookings/me?upcoming=true`).
   - Câu lệnh: `SELECT COUNT(*)::int FROM live_class.bookings b JOIN live_class.classes c ON b.class_id = c.id WHERE b.learner_id = $1 AND b.state = 'confirmed' AND c.starts_at > NOW()`.
4. **Lớp học tiếp theo gần nhất (`nextClass`):**
   - Nguồn: `live-class`. Bản ghi booking sớm nhất trong tương lai, kèm trạng thái `roomAccessEligible` để hiển thị nút CTA vào phòng Jitsi.

### 3.2 Bảng điều khiển Giảng viên (Teacher Dashboard)
1. **Cấp độ kỹ năng được phê duyệt (`approvedSkills`):**
   - Nguồn: `skill-verification` (`GET /api/profile-skills/me`).
   - Đếm số lượng skill có `approvedLevel IS NOT NULL`.
2. **Số lớp đang mở / sắp dạy (`teachingClassesCount`):**
   - Nguồn: `live-class` (`GET /api/classes?teacherId=me`).
   - Câu lệnh: `SELECT COUNT(*)::int FROM live_class.classes WHERE teacher_id = $1 AND state IN ('published', 'in_progress') AND starts_at + (duration_minutes * interval '1 minute') > NOW()`.
3. **Số dư khả dụng & Thu nhập đang chờ (`availableCredit` & `pendingIncomeCredit`):**
   - Nguồn: `wallet-ledger` (`GET /api/wallet/balance`).
   - Bắt buộc tách bạch rõ ràng: `availableCredits` (có thể rút/chi tiêu) và `pendingCredits` (90% tiền giữ chỗ của các lớp chưa hoàn thành).
4. **Lớp sắp dạy tiếp theo (`nextTeachingClass`):**
   - Nguồn: `live-class`. Bản ghi lớp sớm nhất của giảng viên, kèm số học viên đã xác nhận và nút `Start Class`.

---

## 4. Hợp đồng Sự kiện & Bổ sung Payload (`@skillswap/contracts`)

Để hỗ trợ pipeline thông báo bền vững không cần gọi chéo database hoặc HTTP đồng bộ:

### 4.1 Bổ sung vào Sự kiện có sẵn
- **`bookingConfirmedSchema`**:
  - *Hiện tại:* `{ bookingId, studentId, teacherId, amountCredits }`.
  - *Bổ sung:* Thêm trường `classId: z.string().min(1)` (thực tế trong code outbox của `live-class` đã phát ra nhưng thiếu trong Zod schema).

### 4.2 Định nghĩa Sự kiện mới trong `@skillswap/contracts`
1. **`class.rated`**:
   ```ts
   export const classRatedEventSchema = z.object({
     ratingId: z.string().min(1),
     bookingId: z.string().min(1),
     classId: z.string().min(1),
     learnerId: z.string().min(1),
     teacherId: z.string().min(1),
     stars: z.number().int().min(1).max(5),
     comment: z.string().min(1),
     occurredAt: z.string().datetime({ offset: true }),
   });
   ```
2. **`class.reminder.due`** (do module `schedule` phát ra):
   ```ts
   export const classReminderDueEventSchema = z.object({
     classId: z.string().min(1),
     teacherId: z.string().min(1),
     learnerIds: z.array(z.string().min(1)),
     startsAt: z.string().datetime({ offset: true }),
     reminderOffsetMinutes: z.literal(30),
     occurredAt: z.string().datetime({ offset: true }),
   });
   ```
3. **`wallet.transaction.completed`** (do module `wallet-ledger` phát ra):
   ```ts
   export const walletTransactionCompletedEventSchema = z.object({
     transactionId: z.string().min(1),
     accountId: z.string().min(1),
     type: z.enum(['top_up', 'booking_payment', 'booking_refund', 'income_release', 'platform_fee']),
     amountCredits: z.number().int().positive(),
     direction: z.enum(['credit', 'debit']),
     occurredAt: z.string().datetime({ offset: true }),
   });
   ```

---

## 5. Luồng Thông báo Bền vững & Idempotent (Durable Notification Pipeline)

Pipeline đảm bảo thông báo không bị mất khi broker gián đoạn và không bị nhân bản khi consumer retry:

```
[Domain Action in Source Module]
       │
       ▼ (Same DB Transaction)
[Source Aggregate Change + Outbox Row] ──> Commit
       │
       ▼ (Async Polling/Relay)
[RabbitMQ Exchange: skillswap.events]
       │
       ▼ (Queue: account-profile.notification-inbox)
[AccountProfile Consumer]
       ├─ Kiểm tra bảng `account_profile.processed_events` (Idempotent Deduplication)
       ├─ Tạo bản ghi trong `account_profile.inbox_notifications` (Durable Inbox)
       └─ Truy vấn danh sách thiết bị kích hoạt từ `account_profile.notification_devices`
              │
              ▼ (Async Push Worker with Exponential Backoff)
       [Expo Push Service API] ──> [APNs (iOS) / FCM (Android)]
              │
              ▼
       [Nhận Ticket / Receipt]:
         - Nếu trạng thái = 'ok' -> Thành công.
         - Nếu lỗi 'DeviceNotRegistered' -> Tự động vô hiệu hóa device token (Receipt Invalidation).
         - Nếu lỗi mạng/5xx -> Retry theo exponential backoff; vượt quá N lần -> Chuyển vào DLQ.
```

### Bảo mật Payload trên Thiết bị
- Push notification trên Lock Screen chỉ chứa tiêu đề chung và ID đích (`targetType`, `targetId`).
- Tuyệt đối không gửi thông tin số dư chi tiết, giấy tờ sinh viên, hoặc token phòng Jitsi trong push payload.
- Ứng dụng mobile khi mở từ push notification sẽ kích hoạt deep link, yêu cầu session hợp lệ và gọi Gateway để kiểm tra quyền và dữ liệu mới nhất.

---

## 6. Lựa chọn Triển khai đã Chốt (Implementation Choices)

1. **Thứ tự ưu tiên thiết bị (Platform Priority):** iPhone (iOS) là ưu tiên hàng đầu theo cập nhật của người dùng, duy trì tương thích Android.
2. **Tiêu chuẩn Push:** Sử dụng Expo Notifications + Expo Push Service. Nếu thiếu chứng chỉ APNs / FCM production, ghi nhận là rủi ro môi trường ngoại vi chưa hoàn tất, không giả mạo thành công trên thiết bị thật.
3. **Offset nhắc nhở trước giờ học:** Đúng **30 phút** trước giờ bắt đầu của lớp học (`startsAt`).
4. **Tham số tìm kiếm:** Hỗ trợ tìm kiếm theo từ khóa (`keyword`), kỹ năng (`skillId`), khoảng thời gian (`startDate`, `endDate`), và con trỏ (`cursor`).
5. **Bằng chứng năng lực kỹ năng:** Hỗ trợ hình thức công nhận năng lực kèm mô tả chi tiết (`description`) và liên kết tài liệu (`documentRef`).
6. **Mô phỏng thanh toán:** Giữ nguyên mock payment provider hiện có của `wallet-ledger` với chữ ký webhook HMAC phía server.

## 7. Supervisor implementation clarifications

These details govern implementation: all eight new routes require authentication. Class-owner mode uses teacherId=me and includes full/draft as supported by the existing class state enum, while marketplace exposes only publicly visible classes. Keep full classes visible with explicit sold-out status where appropriate. Public teacher display names use a bulk account-profile query facade; no account events exist today. Schedule obtains upcoming classes and confirmed recipients from a live-class public query facade, without cross-schema SQL, and persists its own unique logical reminder + outbox. Do not add class.rated solely for this increment because FR-016 does not request rating notifications. Booking confirmation payload needs classId added at producer and contract together, preserving old consumers/tests. Dashboard uses availableCredits directly. Rating requires confirmed owned booking AND Completed class, never scheduled time alone. Comments/ratings returned by class detail must respect privacy and bounded pagination. GET bookings/me must have explicit true/false query parsing. Network provider/device push is best effort; durable inbox and deduplicated dispatch jobs are the controllable guarantees.
