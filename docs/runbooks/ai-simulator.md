# Simulator dành cho AI (macOS Apple Silicon)

Môi trường mặc định: **Android API 35 ARM64 + ADB + Maestro**. AVD riêng
`SkillSwap_AI_API35`, serial `emulator-5580`, 720×1280 / 320 dpi (360 dp),
2 CPU, 2048 MB RAM. Giữ nguyên AVD khác. Chỉ bật một simulator lúc kiểm thử.

## Dùng hằng ngày

Chạy từ root repository:

```bash
python3 scripts/mobile/simulator.py up
python3 scripts/mobile/simulator.py doctor
python3 scripts/mobile/simulator.py install  # chỉ khi APK/native thay đổi
python3 scripts/mobile/simulator.py open
python3 scripts/mobile/simulator.py capture
python3 scripts/mobile/simulator.py test scripts/mobile/environment-smoke.yaml
python3 scripts/mobile/simulator.py down
```

`capture` in đường dẫn tuyệt đối tới ảnh PNG, XML hierarchy và window dump.
Ảnh/log nằm trong `artifacts/ai-simulator/`; không commit dữ liệu phiên đăng nhập.
`up` chờ tối đa 180 giây, tắt animation và reverse cổng 4000/8081. Không xóa
dữ liệu hay tự thử boot vô hạn. `doctor` báo trạng thái Gateway/Metro riêng biệt.
`test` giới hạn 180 giây; dùng flow nhỏ. Khi app đã đăng nhập, flow kiểm tra form
login không còn phù hợp: chụp hierarchy trước khi chọn flow tiếp theo.

## Backend và Metro

Gateway phải nghe cổng 4000. `/health` phải trả `status: ok`. Không chạy seed/reset
với file `.env` trỏ database từ xa. Dùng stack local riêng theo runbook demo.
Khởi động Metro nếu `doctor` báo chưa chạy:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:4000 pnpm --filter @skillswap/mobile exec expo start --dev-client --localhost
```

ADB reverse cho phép app dùng localhost qua USB/emulator. Dùng bản **debug** cho
HTTP local; bản release phải dùng HTTPS phù hợp. Sửa JS/TS chỉ cần Fast Refresh.
Chỉ rebuild khi đổi native module/plugin/config:

```bash
cd apps/mobile/android
ANDROID_HOME="$HOME/Library/Android/sdk" EXPO_PUBLIC_API_BASE_URL=http://localhost:4000 ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a --max-workers=2 '-Dorg.gradle.jvmargs=-Xmx3072m -XX:MaxMetaspaceSize=1536m'
```

## AI qua MCP hoặc CLI

Maestro MCP được đăng ký ở cấu hình Codex của máy này (không nằm trong repo).
Chat đang mở có thể cần mở lại để thấy tool mới. CLI hoạt động ngay:

```bash
MAESTRO_CLI_NO_ANALYTICS=1 maestro --device emulator-5580 hierarchy
MAESTRO_CLI_NO_ANALYTICS=1 maestro --device emulator-5580 test path/to/flow.yaml
```

Ưu tiên `tapOn` theo text/id và `assertVisible`; chỉ dùng tọa độ sau khi đọc ảnh
hiện tại. `inputText` Android không hỗ trợ Unicode: dùng chuỗi ASCII cho smoke,
không coi đây là nghiệm thu nhập tiếng Việt. Không dùng Maestro Cloud cho dữ liệu
phiên này. Chỉ chạy flow có phạm vi rõ ràng, tránh lặp đăng ký/thanh toán/upload.

## Cài trên máy khác

```bash
brew install --cask android-commandlinetools
brew install mobile-dev-inc/tap/maestro
sdkmanager --sdk_root="$HOME/Library/Android/sdk" 'system-images;android-35;google_apis;arm64-v8a'
```

Sau khi image được cài, chạy `python3 scripts/mobile/simulator.py setup`.
Lệnh tạo AVD từ `scripts/mobile/ai-avd-config.ini`, không ghi đè thiết bị đã có.
Cấu hình 720×1280, density 320, 2 cores, RAM 2048, GPU swiftshader, không snapshot.
Helper kiểm tra tên AVD trước khi sửa/cài/tắt thiết bị để tránh đụng emulator khác.
Không khởi chạy đồng thời build native nặng và nhiều simulator trên máy 16 GB.

Tham khảo: [Android Emulator CLI](https://developer.android.com/studio/run/emulator-commandline),
[Maestro CLI](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli).

## Bằng chứng ngày 11/11/2026

- App debug đã cài và mở trên emulator mới.
- Maestro smoke đạt: chọn ô theo nhãn, nhập/xác nhận/xóa text, đóng bàn phím.
- ADB chụp ảnh và XML hierarchy thành công.
- Maestro MCP initialize/tools-list thành công; chưa cần khởi động lại Codex để dùng CLI.
- `pnpm verify` đạt: mobile 357, API 1238, contracts 258, gateway 37, web 517 tests.
- Đây là kiểm chứng môi trường điều khiển AI, chưa phải nghiệm thu mọi flow nghiệp vụ.

## Jitsi và Expo Router 57

`apps/mobile/metro.config.js` bật `EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK=1` cho
mọi đường bundle. Jitsi có `NavigationIndependentTree` riêng và cần React Navigation
core thật; shim của Expo thiếu `createScreenFactory`, gây lỗi ngay khi nạp SDK.
Không bỏ cấu hình này khi nâng Expo/Jitsi mà chưa kiểm tra join/leave native.
Xem [Expo SDK56 migration – Libraries](https://docs.expo.dev/router/migrate/sdk-55-to-56/#libraries).

Jitsi trong Modal Android dùng bản patch SDK được khai báo ở `pnpm-workspace.yaml`;
không sửa `node_modules` thủ công khi cài lại. Các navigator Jitsi tắt native screen
detachment để không cần ReactRootView trong Modal. Babel chỉ áp dụng Worklets Core
cho SDK Jitsi; app và thư viện gesture vẫn giữ Worklets của Expo. Chạy regression:

```bash
pnpm --filter @skillswap/mobile test -- --runInBand jitsi-babel.spec.ts
```

APK nghiệm thu ARM64 hiện nằm ở `artifacts/ai-simulator/SkillSwap-android-internal-20261112.apk`.
APK có JS bundle, không cần Metro; Gateway local4000 và ADB reverse vẫn cần thiết.
Đây là bản nội bộ localHTTP, không dùng phát hành production. Kết quả web–Android
cùng phòng: `docs/plans/2026-11-12-mobile-runtime-acceptance.md`.
