# Dữ liệu và diễn tập checkpoint 13/10/2026

## Kế hoạch thực hiện

1. Thêm script seed riêng: định danh cố định, namespace checkpoint, không xóa dữ liệu, không ghi đè ví/booking/lớp khi chạy lại. Provision các capability qua projection của từng module, giữ bảy schemas và TypeORM data sources. Commit riêng cho seed.
2. Chuẩn bị hai booking phục vụ hai lần diễn tập bằng API booking/confirm thật. Đọc lại trạng thái settlement và ledger; cung cấp kịch bản và tài khoản. Commit riêng cho công cụ chuẩn bị và hướng dẫn.

## Chạy seed

`node scripts/seed-checkpoint.mjs` cần API đã build và `.env` hợp lệ.
Manifest tại `.secrets/checkpoint-demo.json` chứa tài khoản, mật khẩu và lớp; file được ignore.
Seed tạo fixture xác minh/quyền dạy và số dư ban đầu để bắt đầu demo. Các `document_ref` fixture không chứng minh có file trong storage: luồng upload phải chọn file thật và submit từ Android.

Script cũ `seed-demo.mjs` hiện có reset không giới hạn toàn bộ bảng; không dùng cho database đang chứa dữ liệu cần giữ.

## Tài khoản trình diễn

Mật khẩu fixture mặc định: `Demo1234!`. Chỉ dùng cho môi trường demo local.

| Email | Dùng cho | Trạng thái ban đầu sau chuẩn bị booking |
|---|---|---|
| learner@checkpoint.skillswap.local | Dashboard, booking, nhận push | Đã xác minh; 300 available; 2 lớp sắp học |
| teacher@checkpoint.skillswap.local | Tạo/sửa/hủy lớp | Đã xác minh và được dạy Python; 180 pending |
| poor@checkpoint.skillswap.local | Thiếu credit | Đã xác minh; 20 available |
| upload@checkpoint.skillswap.local | Upload student verification | Chưa gửi xác minh; 0 credit |
| rejected@checkpoint.skillswap.local | Lý do từ chối và gửi lại | Bị từ chối vì ảnh không rõ |
| admin@checkpoint.skillswap.local | Duyệt student verification | Admin, dùng công cụ vận hành có xác thực |
| verifier@checkpoint.skillswap.local | Duyệt skill evidence | Verifier có expertise Python |

## Chuẩn bị booking

`node scripts/prepare-checkpoint-bookings.mjs` đăng nhập learner, giữ chỗ hai lớp push và confirm qua Gateway. Chờ tối đa 30 giây để đọc lại `confirmed`. Không giả lập booking confirmed bằng SQL.

Chạy lại seed và chuẩn bị booking giữ nguyên số dư, trạng thái và operation identity. Không dùng để khôi phục lớp đã hủy: sau hai lượt hủy cần tạo lớp mới qua teacher UI.

## Kịch bản trình diễn

1. **Dashboard:** login learner → refresh trang chủ → thấy xác minh, 300 credit và 2 lớp sắp học. Vào ví xem hai debit 100 credit.
2. **Booking:** tìm `CHECKPOINT` → chọn “Python cơ bản — đặt lớp trực tiếp” → đặt lớp → Pending → xác nhận → chờ settlement → Confirmed. Available từ 300 xuống 200; teacher pending từ 180 lên 270, fee thêm 10.
3. **Thiếu tiền:** login poor → lớp “Python thực hành — thử thiếu credit” → giữ chỗ/xác nhận → xem lỗi thiếu credit từ backend. Không kết luận payment thành công. Dùng ví để tạo top-up intent nếu muốn tiếp tục.
4. **Top-up mô phỏng provider:** tạo intent từ app, lấy providerRef → Mac chạy `node --env-file=.env scripts/mock-topup-callback.mjs --providerRef=REF --amountVnd=100000` → app refresh. Đây là callback provider mock có HMAC; settlement và ledger chạy backend thật.
5. **Resource Class:** login teacher → lớp tôi dạy → mở “Python nâng cao — sửa giá và hủy lớp” → sửa 80 thành 85 → đọc lại → xác nhận hủy. Tạo thêm lớp Python từ UI với ngày sau ít nhất 48 giờ. Hai lớp push có confirmed booking dùng để minh họa server khóa sửa.
6. **Push lần 1:** login learner và bật push → để app background. Teacher dùng thiết bị khác hoặc API có Bearer token để hủy “Python vòng lặp — push hủy lớp lần 1”. Learner bấm banner → lịch hiển thị cancelled; ví tăng 100 sau ledger refund. Chỉ ghi runtime pass khi thật sự thấy remote banner.
7. **Push lần 2:** dùng lớp “Python hàm — push hủy lớp lần 2” cho lần diễn tập tiếp theo. Dữ liệu được chuẩn bị để mỗi lớp có một confirmed booking của learner.
8. **Upload/resources:** login upload → chọn PDF/ảnh thật từ Android → upload → submit student verification → admin duyệt bằng công cụ có auth → app refresh. Kiểm tra object trong MinIO và đọc lại bytes. Learner đã verified có thể thêm Python và submit skill evidence để verifier duyệt. File fixture ghi trong DB không tính là bằng chứng upload.

## Bằng chứng chuẩn bị

Ngày 13/10/2026: hai booking push đạt `confirmed` qua API. Mỗi booking có learner debit 100, teacher pending 90, platform fee 10. Chạy lại cả hai script giữ learner available 300 và teacher pending 180.

Backup trước seed: `/Users/trankien/Downloads/skillswap-demo-backup-20261013/before-checkpoint-seed.dump`.
Push banner, refund sau hủy và upload MinIO cần diễn tập runtime; seed không chứng minh những kết quả này.

Hai script mới qua ESLint; `git diff --check` pass. Full `pnpm verify` dừng ở lint vì unused variable `value` tại `.agents/skills/design-system/scripts/generate-tokens.cjs:148` (skill untracked có sẵn). Các bước gate sau lint chưa chạy trong lượt seed này.

Android Downloads có `checkpoint-demo-upload.pdf`, bản sao PDF checkpoint dùng làm file thử upload; đây là tài liệu demo, không phải chứng từ sinh viên thật.
