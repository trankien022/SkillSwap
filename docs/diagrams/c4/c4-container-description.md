# Mô tả Kiến trúc Container Diagram - SkillSwap

## Tổng quan

Container diagram trình bày cấu trúc nội bộ của **SkillSwap System** ở cấp độ container (cấp độ triển khai/deployment). Hệ thống bao gồm 6 container chính — Web Application, Mobile Application (planned, [ADR-015](../../adr/ADR-015-mobile-client-expo.md)), Gateway, Backend API, Database, Message Broker — và 2 hệ thống ngoại vi.

---

## Các Actor (Người tham gia)

| Actor | Mô tả | Tương tác chính |
|-------|-------|-----------------|
| **Learner (Học viên)** | Sinh viên tìm kiếm, đặt lịch, thanh toán, tham gia lớp học và đánh giá | Web App (HTTPS), Mobile App (HTTPS), Jitsi (WebRTC) |
| **Teacher (Giảng viên sinh viên)** | Sinh viên đăng ký giảng dạy, nộp bằng chứng kỹ năng, tạo lớp, dạy trực tuyến, rút tiền | Web App (HTTPS), Mobile App (HTTPS), Jitsi (WebRTC) |
| **Verifier (Người xác thực)** | Xem xét và duyệt kỹ năng của giảng viên | Web App (HTTPS) |
| **Administrator (Quản trị viên)** | Xác thực sinh viên, quản lý verifier, vận hành hệ thống | Web App (HTTPS) |

---

## Các Container (Đơn vị triển khai)

### 1. Web Application (Frontend)
- **Công nghệ**: **Next.js (React)**
- **Vai trò**: Giao diện người dùng đơn trang (SPA) phục vụ cho 4 loại actor
- **Chức năng**:
  - Trang đăng nhập/đăng ký, xác thực
  - Marketplace khóa học (tìm kiếm, lọc, xem chi tiết)
  - Đặt lịch, thanh toán, ví credit
  - Phòng học trực tuyến (nhúng Jitsi)
  - Chat, đánh giá, hồ sơ cá nhân
  - Dashboard quản trị (cho Admin/Verifier)
- **Tương tác**: Gọi REST API đến Gateway

### 2. Mobile Application (planned — ADR-015)
- **Công nghệ**: **Expo (React Native)** — TypeScript, chia sẻ `packages/contracts` với web
- **Vai trò**: Client iOS/Android cho Learner và Teacher (core flows trong MVP, Increment 6)
- **Phạm vi**: Marketplace, đặt lịch, ví credit, lịch học/dạy, thông báo — đăng nhập/khám phá/social proof vẫn ưu tiên web
- **Tương tác**: Gọi REST API đến Gateway; không kết nối trực tiếp Database hay Message Broker

### 3. Gateway (BFF)
- **Công nghệ**: **NestJS (Node.js)** — port 4000
- **Vai trò**: Điểm vào REST công khai: xác thực JWT, rate limiting, chuyển tiếp route → RPC tới Backend API
- **Tương tác**: Nhận request từ Web App và Mobile App (HTTPS), chuyển tiếp tới Backend API (REST/JSON)

### 4. Backend API
- **Công nghệ**: **NestJS (Node.js)** - Framework Node.js có kiến trúc module, hỗ trợ TypeScript, DI, Guards, Interceptors
- **Vai trò**: Xử lý logic nghiệp vụ, xác thực, phân quyền, truy cập dữ liệu
- **Chức năng chính** (7 module hexagonal dưới `src/modules/`):
  - **account-profile**: Xác thực/JWT, hồ sơ, roles
  - **student-verification**: Xác thực sinh viên (CCCD, thẻ sinh viên)
  - **skill-verification**: Quy trình duyệt kỹ năng giảng viên
  - **schedule**: Lịch dạy/lớp học, trạng thái lớp
  - **live-class**: Đặt lịch, thanh toán, tích hợp Jitsi (tạo phòng, lấy URL join)
  - **wallet-ledger**: Ví credit, nạp/rút tiền, ledger giao dịch (integer VND)
  - **admin-operation**: Vận hành, quản lý verifier, dashboard quản trị
- **Tương tác**:
  - Nhận request từ Gateway (REST/JSON)
  - Truy vấn/ghi Database (TypeORM)
  - Xuất bản integration event qua Message Broker (AMQP, transactional outbox)
  - Gọi Payment Gateway (REST/JSON)
  - Gọi Jitsi API (REST/HTTPS) để tạo phòng

### 5. Database
- **Công nghệ**: **PostgreSQL** - CSDL quan hệ mã nguồn mở, hỗ trợ JSONB, index nâng cao
- **ORM**: **TypeORM** (type-safe database access — [ADR-014](../../adr/ADR-014-persistence-typeorm.md))
- **Các bảng chính**:
  - `users` - Tài khoản, vai trò, thông tin cá nhân
  - `student_verifications` - Xác thực sinh viên (CCCD, thẻ sinh viên)
  - `teacher_skills` - Kỹ năng giảng viên, bằng chứng, trạng thái duyệt
  - `classes` - Lớp học, giá, lịch, trạng thái
  - `bookings` - Đặt lịch, thanh toán, trạng thái
  - `wallets` - Số dư, giao dịch nạp/rút
  - `reviews` - Đánh giá, rating
  - `jitsi_rooms` - Mapping phòng Jitsi với lớp học

Dữ liệu phân vùng theo **7 schema** (mỗi module một schema, role/credential riêng — ADR-007), không có cross-schema join/foreign key.

### 6. Message Broker (ADR-013)
- **Công nghệ**: **RabbitMQ 3.13** — topic exchange `skillswap.events`
- **Vai trò**: Giải phóng Backend API khỏi xử lý tích hợp bất đồng bộ (email, notification, export…)
- **Cơ chế**:
  - **Transactional outbox**: sự kiện ghi cùng transaction nghiệp vụ, relay chuyển lên exchange
  - **Idempotent consumers**: dedupe trên `messageId`
  - **Retry + DLQ**: hàng `.retry` / `.dlq`, tin nhắn poison không chặn luồng chính
- **Tương tác**: Chỉ `apps/api/src/shared/messaging` được phép kết nối broker (arch test `pnpm test:arch`)

---

## Hệ thống Ngoại vi (External Systems)

| Hệ thống | Mô tả | Tương tác |
|----------|-------|-----------|
| **Payment Gateway** | Cổng thanh toán (VNPay, MoMo, Stripe, PayPal) | Backend API gọi REST/JSON để tạo đơn, xác nhận webhook |
| **Jitsi** | Máy chủ hội nghị video mã nguồn mở (WebRTC) | Backend API tạo phòng qua REST; Learner/Teacher kết nối trực tiếp qua WebRTC từ trình duyệt |

---

## Luồng dữ liệu chính

### 1. Learner đặt và tham gia lớp (Booking Flow)
```
Learner → Web App/Mobile App (HTTPS) → Gateway (HTTPS) → Backend API (REST) → Database (TypeORM)
                                                                     ↓
                                                          Payment Gateway (REST)
                                                                     ↓
                                                          Jitsi API (REST) → Trả về room URL
                                                                     ↓
Learner → Jitsi (WebRTC - trực tiếp từ browser)
```

### 2. Teacher tạo và dạy lớp (Teaching Flow)
```
Teacher → Web App/Mobile App (HTTPS) → Gateway (HTTPS) → Backend API (REST) → Database (TypeORM)
                                                                     ↓
                                                          Jitsi API (REST) → Tạo phòng, trả URL
                                                                     ↓
Teacher → Jitsi (WebRTC - trực tiếp từ browser)
```

### 3. Verifier duyệt kỹ năng (Verification Flow)
```
Verifier → Web App (HTTPS) → Gateway (HTTPS) → Backend API (REST) → Database (TypeORM)
```

---

## Triển khai (Deployment Overview)

```
☁ Cloud Provider (AWS/Azure/GCP)
  ├─ Application Tier (Kubernetes/ECS)
  │   ├─ Web App (Next.js) - Multiple replicas
  │   ├─ Gateway (NestJS) - Multiple replicas
  │   └─ Backend API (NestJS) - Multiple replicas
  ├─ Messaging Tier (RabbitMQ 3.13)
  │   └─ Message Broker - topic exchange skillswap.events
  └─ Data Tier (Managed PostgreSQL - RDS/Cloud SQL)
      └─ Database (PostgreSQL)
```

- **Web App**: Static assets có thể deploy lên CDN (Vercel, CloudFront, Netlify)
- **Mobile App**: Phân phối qua Expo/EAS (App Store, Play Store) — client, không nằm trong server deployment
- **Gateway / Backend API**: Containerized (Docker), horizontal scaling qua K8s/ECS
- **Message Broker**: Cluster RabbitMQ trong Messaging Tier, durable queues (ADR-013)
- **Database**: Managed service (AWS RDS, Azure Database, Google Cloud SQL) với backup tự động, read replicas
- **Jitsi**: Self-hosted trên VM/K8s riêng hoặc dùng Jitsi-as-a-Service (8x8.vc)

---

## Quy ước kỹ thuật

| Yếu tố | Quy ước |
|--------|---------|
| API Style | RESTful JSON, OpenAPI/Swagger spec |
| Auth | JWT (Access + Refresh token), HttpOnly cookies |
| Validation | class-validator + DTO (NestJS) |
| Database Migration | TypeORM migrations (script `pnpm db:migrate`) |
| Real-time | Socket.io (Gateway module NestJS) hoặc WebSocket native |
| Logging | Structured JSON (pino/winston), ELK/Loki |
| Monitoring | Prometheus + Grafana, Health checks |
| CI/CD | GitHub Actions / GitLab CI → Docker → K8s/ECS |

---

## Mở rộng trong tương lai

- **Cache** (Redis): Session store, rate limiting, cache query thường dùng
- **Search** (Elasticsearch/Meilisearch): Tìm kiếm full-text khóa học, giảng viên
- **File Storage** (S3/MinIO): Lưu bằng chứng kỹ năng, avatar, tài liệu lớp
- **CDN**: Phân phối static assets, recording lớp học

_Message Broker (RabbitMQ) đã có trong kiến trúc hiện tại (ADR-013) — không còn ở mục tương lai._