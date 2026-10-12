# Dữ liệu và diễn tập checkpoint 13/10/2026

## Kế hoạch thực hiện

1. Thêm script seed riêng: định danh cố định, namespace checkpoint, không xóa dữ liệu, không ghi đè ví/booking/lớp khi chạy lại. Provision các capability qua projection của từng module, giữ bảy schemas và TypeORM data sources. Commit riêng cho seed.
2. Chuẩn bị hai booking phục vụ hai lần diễn tập bằng API booking/confirm thật. Đọc lại trạng thái settlement và ledger; cung cấp kịch bản và tài khoản. Commit riêng cho công cụ chuẩn bị và hướng dẫn.

## Chạy seed

`node scripts/seed-checkpoint.mjs` cần API đã build và `.env` hợp lệ.
Manifest tại `.secrets/checkpoint-demo.json` chứa tài khoản, mật khẩu và lớp; file được ignore.
Seed tạo fixture xác minh/quyền dạy và số dư ban đầu để bắt đầu demo. Các `document_ref` fixture không chứng minh có file trong storage: luồng upload phải chọn file thật và submit từ Android.

Script cũ `seed-demo.mjs` hiện có reset không giới hạn toàn bộ bảng; không dùng cho database đang chứa dữ liệu cần giữ.
