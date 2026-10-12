# Chạy demo mobile Week 6 trên Mac

## Môi trường đã chuẩn bị

- Repo `/Users/trankien/Documents/SkillSwap`, nhánh `codex/mobile-checkpoint-android`.
- Android AVD `Medium_Phone_API_37.0`, Google Play services; package `com.skillswap.app`.
- Gateway4000, API4001, Metro8081, MinIO9000. `.env`, mobile `.env`, Firebase config và manifest checkpoint nằm ngoài Git.
- Tài khoản và mật khẩu lấy từ `.secrets/checkpoint-demo.json`; không đưa manifest vào video/log. Vai trò user có capability học/dạy; không đổi role.
- Evidence: `/Users/trankien/Downloads/skillswap-mobile-evidence-20261013`. Giữ snapshot DB riêng. Không chạy `pnpm db:demo`, `scripts/seed-demo.mjs` hoặc reset DB để diễn tập.

## Mở stack nếu máy đã restart

Chạy từ repo, mỗi app một terminal. Kiểm tra port trước để tránh hai API consumers cùng chạy:

```sh
pnpm db:up
pnpm --filter @skillswap/api start
pnpm --filter @skillswap/gateway dev
```

MinIO cần giữ endpoint `localhost:9000` đúng hostname URL đã ký. Nếu MinIO dùng tunnel ở máy này, mở lại tunnel trước upload; không đổi signed hostname thành `10.0.2.2`.

Mở AVD qua Android Studio Device Manager hoặc:

```sh
/Users/trankien/Library/Android/sdk/emulator/emulator -avd Medium_Phone_API_37.0
/Users/trankien/Library/Android/sdk/platform-tools/adb reverse tcp:4000 tcp:4000
/Users/trankien/Library/Android/sdk/platform-tools/adb reverse tcp:9000 tcp:9000
/Users/trankien/Library/Android/sdk/platform-tools/adb reverse tcp:8081 tcp:8081
```

Development APK dùng Metro:

```sh
cd /Users/trankien/Documents/SkillSwap/apps/mobile
EXPO_PUBLIC_API_EVIDENCE=1 pnpm dev --dev-client --localhost
/Users/trankien/Library/Android/sdk/platform-tools/adb shell am start -a android.intent.action.VIEW -d 'skillswap://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081' com.skillswap.app
```

Development launcher có thể xuất hiện khi cold start từ notification; APK preview ARM64 có JS đã nghiệm thu cold start/banner/tap đúng lịch; dùng bản này cho demo ổn định. Không uninstall để thay APK nếu chữ ký khớp; `adb install -r` giữ session.

## Thứ tự trình diễn

1. Learner login → Dashboard account/xác minh/ví/lịch. Mở lại app để thấy session; refresh đọc backend.
2. Teacher tạo lớp Python mới qua UI, giờ >=48h; sửa giá chưa có Confirmed booking; đọc lại detail. Dùng một lớp riêng để hủy Resource flow.
3. Learner tìm lớp mới → Detail → giữ chỗ Pending → xác nhận → processing nếu settlement chưa xong → Confirmed. Đọc lịch và ví; ledger100/90/10.
4. Poor có20 credit: giữ chỗ lớp100, UI chặn thiếu tiền. Nạp100 credit qua intent UI; dùng `scripts/mock-topup-callback.mjs` trên Mac với secret từ root env, rồi refresh và xác nhận. Công bố **mô phỏng provider**, không giả lập số dư trong app.
5. Learner bật push; giữ learner session và background. Teacher cancel bằng công cụ ops có auth trên Mac → remote notification → tap → Lịch của tôi → Khác → cancelled → Ví/refund. Lớp `CHECKPOINT - Python demo live` còn published100 credit để demo. Tạo lớp mới cho mỗi lượt tiếp theo; các lớp push diễn tập đã hủy, không dùng lại.
6. Upload account → chọn PDF Android Download → upload/submit. Admin có auth duyệt, mobile refresh thấy result. Kỹ năng: submit mô tả → verifier claim/approve → history.
7. Cài đặt tiếng Việt/English đồng bộ language thiết bị; push gửi sau khi đồng bộ dùng ngôn ngữ đó. Thông báo đã hiển thị trước khi đổi Cài đặt không được viết lại.

## Bản dự phòng

Dùng `booking-success.mp4` cho booking sau fix, PDF readback và ma trận API trong `mobile-week6-evidence.md`. Video là bổ trợ live demo. Không dùng video đã ghi lỗi như `booking.mp4` hay `push-open.mp4` để tuyên bố pass.

Chưa nghiệm thu: Jitsi/reminder/rating/iPhone. Các lỗi còn mở ở báo cáo evidence phải được công bố; seed và unit tests không thay thế việc chạy UI.


APK đã cài: `~/Downloads/skillswap-mobile-evidence-20261013/skillswap-week6-arm64-preview.apk`. Bản này không cần Metro, vẫn cần Gateway/API/MinIO và adb reverse. Video push thành công: `push-preview-coldstart-success.mp4`.


Trạng thái dữ liệu cuối: learner500 available, poor20 available, teacher90 pending. Poor đã có booking Confirmed tại lớp demo live; learner chưa đặt lớp này. Hủy lớp demo sẽ hoàn credit cho mọi booking hợp lệ, mỗi booking đúng1 lần. Tiếng Việt đã được khôi phục trong Cài đặt và quyền push đã grant/enable lại.
