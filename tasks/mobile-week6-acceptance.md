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
