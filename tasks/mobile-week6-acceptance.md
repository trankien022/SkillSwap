# Kế hoạch nghiệm thu mobile Week 6

Phạm vi đã được người dùng duyệt: Android Emulator Google Play, >=5 resources, 20–30 API thật, Dashboard / Booking / Resource Class, remote push hủy lớp và upload MinIO. Giữ Expo SDK/contracts/bảy schemas; không reset dữ liệu. Top-up provider mock được công bố. Reminder/Jitsi/rating/iPhone ngoài phạm vi.

## Phases và commits

1. Môi trường/session/Dashboard: xác nhận runtime, bổ sung request evidence không chứa secret, kiểm tra restart/account switch/offline và refresh dữ liệu. Commit riêng cho instrumentation/fix cần thiết.
2. Booking/payment: thao tác UI search/detail/hold/confirm/reconcile; funded/poor/top-up HMAC; ledger 100/90/10 và idempotency. Chỉ sửa khi gặp lỗi; commit riêng.
3. Class resource: teacher list/detail/create/edit/cancel; lớp sau >=48h; edit lock/ownership; trạng thái tiếng Việt. Commit riêng nếu cần fix.
4. Push: listener phải điều hướng ngay sau tap; learner background, teacher API cancel trên Mac; kiểm tra inbox/delivery/ticket/receipt/banner/schedule/refund, account rebind/logout/dedup. Commit riêng cho fix.
5. Upload/evidence: Android picker/upload/submit/admin approval/refresh, object bytes readback; skill catalogue/description/history/verifier approval. Thu evidence 26 route templates; không tính ops/callback/storage PUT vào mobile API.
6. Đóng gói: focused tests/typecheck/full verify/diff check, ma trận màn hình-route-FR-evidence, checklist có code/test/runtime, hai lần diễn tập, APK/video/runbook, Graphify update. Gate không pass phải ghi blocker thực tế.

## Điều kiện đạt

Ba luồng đi từ UI tới backend; >=5 resource persisted; 20–30 route templates có request thực từ app; storage bytes đọc lại khớp; remote banner nghiệp vụ được nhận và tap đúng lịch; hoàn 100 credit đúng một lần. Fixture seed, provider receipt và test pass không thay thế runtime evidence.

## Bổ sung: ngôn ngữ thông báo theo Cài đặt

1. Contract/persistence: thêm locale vi/en vào đăng ký thiết bị, lưu qua entity column và migration additive; không sửa migration cũ. Push lấy locale hiện tại của thiết bị khi claim delivery và chọn copy nghiệp vụ tương ứng.
2. Mobile: giữ locale trong SecureStore; chờ khôi phục locale trước rebind; đăng ký lại khi đổi ngôn ngữ. Inbox tiếp tục dịch theo locale UI. Không cấp quyền qua payload.
3. Nghiệm thu: tests copy vi/en, device locale persistence và callback đăng ký; build/typecheck/full verify; đổi Cài đặt trên Android và kiểm tra backend/push thực. Commit riêng cho thay đổi ngôn ngữ.

## Fix sau nghiệm thu cold start

1. Chờ root navigation và route đăng nhập/index hoàn tất trước khi tiêu thụ đích thông báo; giữ pending target trong lúc khôi phục session để Redirect không ghi đè lịch.
2. Thêm regression test navigation readiness, chạy focused/full gate và build lại APK có JS; nghiệm thu tap khi tiến trình không tồn tại trước tap, ghi video và ledger/refund.

## Fix sau probe account rebind

1. Database test riêng tái hiện pending delivery của account cũ trên device đã rebind account mới: store hiện claim thành sending. Không gọi provider trong probe.
2. Trong account-profile, fail pending/sending jobs khi device inactive hoặc account không khớp inbox; claim SELECT cũng fence account hiện tại. Không sửa schema, không mở API.
3. Regression SQL store tests + probe DB trước/sau; full verify, rebuild/restart API và cập nhật Graphify. Push đã được provider chấp nhận trước logout không thể thu hồi; payload không cấp quyền và tap luôn đọc bằng session hiện tại.
