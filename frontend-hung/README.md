# SkillSwap — Next.js, API xác thực và ví

## Chạy trên Windows

1. Giải nén và mở thư mục `skillswap-demo` (thư mục có `package.json`) trong VS Code.
2. Trong terminal chạy:

```powershell
npm install
npm run dev
```

3. Mở http://localhost:3000. Backend của nhóm phải chạy gateway tại http://localhost:4000.

Để đổi gateway, sao chép `.env.example` thành `.env.local`, sửa `API_GATEWAY_URL`, rồi khởi động lại Next.js. Các request mặc định đi qua proxy Next.js `/backend/api/*` tới gateway `/api/*`, giúp tránh CORS khi chạy riêng. Nếu web và backend nằm trên các máy khác nhau, dùng địa chỉ gateway mà máy chạy Next.js truy cập được. Không gọi thẳng API nội bộ cổng 4001.

Node.js tối thiểu 20.9; Node.js 24 dùng được.

## Đã nối theo FRONTEND-API-GUIDE.md

| UI | API |
|---|---|
| Đăng ký | POST /api/auth/register — email, displayName, password, role: learner |
| Đăng nhập | POST /api/auth/login — email, password |
| Hồ sơ trên thanh điều hướng | GET /api/auth/me |
| Tự làm mới token khi 401 | POST /api/auth/refresh |
| Đăng xuất | POST /api/auth/logout |
| Credit khả dụng / thu nhập đang giữ | GET /api/wallet/balance |
| Nạp tiền | POST /api/wallet/top-ups — amountVnd |

Không còn tài khoản demo minh@example.com hoặc mật khẩu bất kỳ. Đăng ký hoặc dùng tài khoản thật trên backend của nhóm. Mật khẩu không lưu ở frontend. Trường đại học được vô hiệu hóa vì API đăng ký không nhận trường này. Google/Microsoft được vô hiệu hóa vì tài liệu chưa có OAuth. Nút đăng ký không còn hứa bonus 50 credit; số dư lấy từ backend.

Token lưu trong sessionStorage của tab đang mở; tải lại vẫn giữ phiên, đóng tab sẽ mất phiên. Không dùng tài khoản mock cũ ở localStorage. Refresh được khóa dùng chung để nhiều request 401 không sử dụng lại refreshToken một lần; token mới thay token cũ. Khi tích hợp production, chuyển sang phiên cookie HttpOnly phía server.

Nạp tiền hỏi số VND (số nguyên dương, bội số 1.000, tối đa 100.000.000), gửi intent và chuyển tới paymentUrl. Không tự tăng số dư và không gọi callback/HMAC từ frontend. Backend hiện trả URL mock theo tài liệu; URL đó cần hệ thống payment/mock tương ứng mới chạy được. Sau khi thanh toán, quay về trang Khám phá để kiểm tra ví; ví cũng cập nhật khi quay lại tab và mỗi 15 giây lúc tab đang hiển thị. Chưa có endpoint trạng thái top-up nên không thể khẳng định giao dịch thành công chỉ từ số dư.

## Vẫn mock / chưa có API

- 4 thẻ lớp và tìm kiếm/bộ lọc vẫn mock. Không tự đặt thêm endpoint GET /classes vì tài liệu chưa cung cấp.
- Giữ chỗ khi chưa đăng nhập → đăng nhập. Khi đã đăng nhập → thông báo lớp mock chưa có classId thật. Chưa gọi booking/confirm hay trừ tiền.
- Trang lớp học của tôi, studio, xác minh, trợ giúp, chính sách, thông báo, lịch sử giao dịch và phòng học chưa triển khai trong hai màn hình này.
- Không gọi API quản trị/tạo lớp/rút tiền/chat vì không thuộc hai màn hình.

## Source

- `src/lib/api.mjs`: request client, bearer token, refresh, auth, logout.
- `next.config.js`: proxy tới gateway.
- `.env.example`: cấu hình địa chỉ.
- `src/components/StitchScreen.jsx`: gắn sự kiện vào HTML tin cậy của Stitch và cập nhật UI bằng API.
- `src/designs/*.json`: markup xuất Stitch; không chèn HTML từ người dùng/API.
- `src/data/classes.json`: nhóm/giá/hình thức của 4 lớp mock.
- `src/app/globals.css`, `tailwind.config.js`: giao diện.
- `material-symbols/outlined.css`: icon đóng gói cục bộ, đã sửa lỗi icon hiện thành chữ.

Google Fonts cho chữ và ảnh đại diện/logo vẫn dùng URL gốc Stitch. Backend chưa có school/avatar nên chỉ cập nhật tên và role; ảnh mẫu vẫn là ảnh Stitch, không phải ảnh hồ sơ thật.

## Kiểm tra

`npm run build` đã qua. Đã kiểm tra request/body, bearer header, refresh đồng thời và xoay token, lỗi API, logout 204, đăng ký chuyển trang, cập nhật tên và số dư bằng response giả lập đúng schema. Chưa có backend nhóm trong môi trường này nên chưa kiểm tra end-to-end với server thật.

Nếu đăng nhập báo lỗi kết nối: kiểm tra gateway 4000, địa chỉ `.env.local`, và backend đang chạy. Nếu lỗi tài khoản: đọc thông báo trả về từ backend; không dùng tài khoản demo cũ.

## Dependencies đã cập nhật

Dùng Tailwind CSS 4.3.3, @tailwindcss/postcss 4.3.3, PostCSS 8.5.29 và forms plugin 0.5.11. Cấu hình CSS đã chuyển sang Tailwind 4; bỏ container-queries plugin cũ vì Tailwind 4 hỗ trợ sẵn. Cập nhật package-lock.json cùng source. Không cần chạy npm audit fix --force.
