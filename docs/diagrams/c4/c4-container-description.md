# Mô tả Kiến trúc Container Diagram - SkillSwap

## Tổng quan

Container diagram trình bày cấu trúc nội bộ của **SkillSwap System** ở cấp độ container (cấp độ triển khai/deployment). Hệ thống bao gồm 3 container chính và 2 hệ thống ngoại vi.

---

## Các Actor (Người tham gia)

| Actor | Mô tả | Tương tác chính |
|-------|-------|-----------------|
| **Learner (Học viên)** | Sinh viên tìm kiếm, đặt lịch, thanh toán, tham gia lớp học và đánh giá | Web App (HTTPS), Jitsi (WebRTC) |
| **Teacher (Giảng viên sinh viên)** | Sinh viên đăng ký giảng dạy, nộp bằng chứng kỹ năng, tạo lớp, dạy trực tuyến, rút tiền | Web App (HTTPS), Jitsi (WebRTC) |
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
- **Tương tác**: Gọi REST API đến Backend API

### 2. Backend API
- **Công nghệ**: **NestJS (Node.js)** - Framework Node.js có kiến trúc module, hỗ trợ TypeScript, DI, Guards, Interceptors
- **Vai trò**: Xử lý logic nghiệp vụ, xác thực, phân quyền, truy cập dữ liệu
- **Chức năng chính**:
  - **Auth Module**: JWT authentication, role-based access control (Learner/Teacher/Verifier/Admin)
  - **User Module**: Quản lý hồ sơ, xác thực sinh viên, quản lý kỹ năng
  - **Class Module**: CRUD lớp học, lịch dạy, trạng thái lớp
  - **Booking Module**: Đặt lịch, hủy, lịch sử, thanh toán
  - **Wallet Module**: Ví credit, nạp/rút tiền, lịch sử giao dịch
  - **Review Module**: Đánh giá, rating sau lớp
  - **Chat Module**: Tin nhắn real-time (WebSocket)
  - **Verification Module**: Quy trình duyệt kỹ năng giảng viên
  - **Jitsi Integration**: Tạo phòng học, lấy URL join
- **Tương tác**:
  - Nhận request từ Web App (REST/JSON)
  - Truy vấn/ghi Database (TypeORM/Prisma ORM)
  - Gọi Payment Gateway (REST/JSON)
  - Gọi Jitsi API (REST/HTTPS) để tạo phòng

### 3. Database
- **Công nghệ**: **PostgreSQL** - CSDL quan hệ mã nguồn mở, hỗ trợ JSONB, index nâng cao
- **ORM**: **TypeORM** hoặc **Prisma** (type-safe database access)
- **Các bảng chính**:
  - `users` - Tài khoản, vai trò, thông tin cá nhân
  - `student_verifications` - Xác thực sinh viên (CCCD, thẻ sinh viên)
  - `teacher_skills` - Kỹ năng giảng viên, bằng chứng, trạng thái duyệt
  - `classes` - Lớp học, giá, lịch, trạng thái
  - `bookings` - Đặt lịch, thanh toán, trạng thái
  - `wallets` - Số dư, giao dịch nạp/rút
  - `reviews` - Đánh giá, rating
  - `messages` - Tin nhắn chat
  - `jitsi_rooms` - Mapping phòng Jitsi với lớp học

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
Learner → Web App (HTTPS) → Backend API (REST) → Database (TypeORM)
                                    ↓
                              Payment Gateway (REST)
                                    ↓
                              Jitsi API (REST) → Trả về room URL
                                    ↓
Learner → Jitsi (WebRTC - trực tiếp từ browser)
```

### 2. Teacher tạo và dạy lớp (Teaching Flow)
```
Teacher → Web App (HTTPS) → Backend API (REST) → Database (TypeORM)
                                    ↓
                              Jitsi API (REST) → Tạo phòng, trả URL
                                    ↓
Teacher → Jitsi (WebRTC - trực tiếp từ browser)
```

### 3. Verifier duyệt kỹ năng (Verification Flow)
```
Verifier → Web App (HTTPS) → Backend API (REST) → Database (TypeORM)
```

---

## Triển khai (Deployment Overview)

```
☁ Cloud Provider (AWS/Azure/GCP)
  ├─ Application Tier (Kubernetes/ECS)
  │   ├─ Web App (Next.js) - Multiple replicas
  │   └─ Backend API (NestJS) - Multiple replicas
  └─ Data Tier (Managed PostgreSQL - RDS/Cloud SQL)
      └─ Database (PostgreSQL)
```

- **Web App**: Static assets có thể deploy lên CDN (Vercel, CloudFront, Netlify)
- **Backend API**: Containerized (Docker), horizontal scaling qua K8s/ECS
- **Database**: Managed service (AWS RDS, Azure Database, Google Cloud SQL) với backup tự động, read replicas
- **Jitsi**: Self-hosted trên VM/K8s riêng hoặc dùng Jitsi-as-a-Service (8x8.vc)

---

## Quy ước kỹ thuật

| Yếu tố | Quy ước |
|--------|---------|
| API Style | RESTful JSON, OpenAPI/Swagger spec |
| Auth | JWT (Access + Refresh token), HttpOnly cookies |
| Validation | class-validator + DTO (NestJS) |
| Database Migration | TypeORM migrations hoặc Prisma migrate |
| Real-time | Socket.io (Gateway module NestJS) hoặc WebSocket native |
| Logging | Structured JSON (pino/winston), ELK/Loki |
| Monitoring | Prometheus + Grafana, Health checks |
| CI/CD | GitHub Actions / GitLab CI → Docker → K8s/ECS |

---

## Mở rộng trong tương lai

- **Message Queue** (RabbitMQ/Kafka): Xử lý async (gửi email, notification, export báo cáo)
- **Cache** (Redis): Session store, rate limiting, cache query thường dùng
- **Search** (Elasticsearch/Meilisearch): Tìm kiếm full-text khóa học, giảng viên
- **File Storage** (S3/MinIO): Lưu bằng chứng kỹ năng, avatar, tài liệu lớp
- **CDN**: Phân phối static assets, recording lớp học