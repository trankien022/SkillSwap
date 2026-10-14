# SkillSwap Mobile — API Mapping cho TASK-04

## 1. Phạm vi

Tài liệu ghi nhận luồng đọc chi tiết lớp học của người học và người dạy, cùng phần kiểm thử và kiểm tra thủ công của TASK-04.

## 2. API chi tiết lớp học

- Endpoint: `GET /api/classes/{id}`.
- Mobile gateway: `BookingHttpGateway.getClassDetail(classId)` trong `apps/mobile/src/infrastructure/http/booking-http-gateway.ts`.
- Gateway mã hóa ID bằng `encodeURIComponent`, gửi request xác thực qua `GatewayClient`, rồi parse response bằng `classDetailViewSchema` từ `@skillswap/contracts`.
- Response có trạng thái lớp, thông tin người dạy, số chỗ, `canBook` và `ownBooking`.
- Backend yêu cầu đăng nhập. Người dạy được xem lớp nháp của chính mình; người ngoài không được xem lớp nháp. Lớp đang diễn ra/kết thúc/bị hủy chỉ hiển thị cho người dạy hoặc người có booking.

## 3. Màn hình chi tiết lớp của người học

- Màn hình: `apps/mobile/src/ui/class-detail-view.tsx`.
- `ClassDetailCoordinator` dùng `BookingHttpGateway.getClassDetail(classId)` khi vào màn hình và để đọc lại dữ liệu có thẩm quyền sau thao tác đặt/xác nhận.
- Màn hình giữ tải lại khi được focus, loading, not-found và error states; lỗi đọc không tạo dữ liệu lớp thay thế.
- Catalogue kỹ năng chỉ dùng để tra tên từ `skillIds`, không dùng tìm lớp theo ID.
- TASK-04 không đổi luồng đọc lớp hiện có của người học.

## 4. Màn hình chi tiết lớp của người dạy

- Màn hình: `apps/mobile/app/(features)/teaching/[id].tsx`.
- Trước khi sửa, màn hình tải danh sách `teacherId=me`, giới hạn 50 bản ghi, rồi tìm lớp theo ID. Lớp ngoài 50 kết quả đầu bị báo không tìm thấy.
- Hiện màn hình gọi trực tiếp `BookingHttpGateway.getClassDetail(classId)`, dùng kiểu `ClassDetailView` và không tải catalogue để tìm lớp.
- Màn hình tải lại khi focus và sau thao tác; điều kiện sửa/hủy/bắt đầu/hoàn tất vẫn dựa trên `state` từ API.
- Có loading state. Khi đọc thất bại, màn hình xóa chi tiết cũ và hiển thị not-found riêng cho HTTP 404 hoặc lỗi tải cho lỗi khác; không tạo lớp giả.
- Hai ô giá và số chỗ có `minWidth: 0` để không ép tràn bố cục hẹp.

## 5. Kiểm tra tự động

- `apps/mobile/src/infrastructure/http/booking-http-gateway.spec.ts`: kiểm tra route GET, URL encoding, parse schema, draft state, 404, GET retry và POST không tự phát lại sau 401.
- `apps/mobile/src/ui/teaching-class-detail.spec.tsx`: kiểm tra mở lớp ngoài 50 kết quả mà không gọi catalogue, lớp nháp không có thao tác dành cho lớp published, và lỗi API không hiển thị dữ liệu giả.
- `apps/mobile/src/ui/class-detail-coordinator.spec.ts`: kiểm tra lỗi đọc chi tiết không tạo fallback class data.
- Mobile Jest suite: **242 tests passed**; build TypeScript mobile: **passed**.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` và `pnpm test:arch`: **passed** (gateway 37, contracts 161, API 601, mobile 242, web 210 tests).
- `pnpm verify` vẫn dừng ở `apps/web` build: Next.js báo `Failed to load native binding` khi nạp `next.config.ts`. Chưa xác định đây là lỗi của TASK-04.
- UI test dùng `react-test-renderer@19.2.3`; React 19 phát cảnh báo deprecation, nhưng các test đều pass.

## 6. Kiểm tra thủ công còn lại

- Trên Android, mở một lớp nháp bằng tài khoản người dạy và xác nhận không hiện thao tác sửa/hủy/đăng lớp sai trạng thái.
- Mở lớp của người dạy nằm ngoài 50 lớp đầu và xác nhận chi tiết hiển thị.
- Dùng tài khoản người học mở lớp published và xác nhận thông tin/booking state khớp API.
- Kiểm tra bố cục 360 px và cả locale tiếng Việt/Anh.
