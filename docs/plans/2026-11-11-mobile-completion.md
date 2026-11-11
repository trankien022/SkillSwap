# Plan hoàn tất Mobile SkillSwap

## Tóm tắt hiện trạng

`main` hiện đã có code/test cho:

- Auth, session restore, logout, locale VI/EN.
- Marketplace, class detail, booking/confirmation, lịch.
- Wallet, SePay top-up, ledger history.
- Student verification upload/resubmit.
- Skill evidence dạng mô tả, history và verifier queue.
- Teacher create/edit/cancel/no-show.
- Notification inbox, device registration, push lifecycle.
- Rating form và rating gateway.

Kiểm tra hiện tại: **261 mobile tests pass, 35 suites, typecheck pass**.

Các phần còn thiếu hoặc chưa đủ bằng chứng:

1. Native Jitsi trên `main` chưa hoàn chỉnh; hiện room access mới dừng ở mở URL.
2. Mobile chưa có in-class chat dù backend/contracts đã có.
3. Certificate evidence upload chưa hoàn chỉnh trên `main`; màn hình hiện chủ yếu gửi `verifier_assessment`.
4. Notification read-state và mark-as-read cần đồng bộ với backend branch mới.
5. Release build vẫn có nguy cơ fallback sang mock khi thiếu `EXPO_PUBLIC_API_BASE_URL`.
6. Chưa có nghiệm thu simulator cho các flow chính.
7. Push thật trên iOS Simulator không chứng minh được APNs thật; chỉ kiểm tra inbox, deep link và local/native behavior.

FR-014 withdrawal tiếp tục **deferred theo SRS**. Admin dashboard tiếp tục giữ ở web.

## Ma trận task còn thiếu

| Task | Trạng thái hiện tại | Việc cần làm |
|---|---|---|
| T02 Push native | Partial | Android Emulator smoke; iOS Simulator chỉ kiểm tra inbox/deep link/local notification |
| T03 Jitsi/upload/payment runtime | Partial | Jitsi native, SePay pending/settled, upload retry |
| T04–T14 core flows | Có source/test | Chỉ hardening và simulator acceptance, không viết lại |
| T15 Room access | Open | Native Jitsi, access window, participant/teacher path |
| T16 Rating | Partial | Readback, duplicate/eligibility, state reset |
| T17 Device lifecycle | Partial | Permission denied, logout/rebind, locale sync |
| T18 Inbox | Partial | Mark one/all read, unread count, pagination, deep link |
| T19 Push | Partial | Android emulator delivery; iOS simulator limitation documented |
| T20 Reminder | Backend đã có | Kiểm tra mobile inbox/deep link theo reminder event |
| T21 Regression | Open | Offline/session/error/accessibility checks |
| T22 Release evidence | Open | Android APK + iOS Simulator build + evidence matrix |

## Phase 0 — Chốt baseline và hợp nhất thay đổi liên quan

- Tạo branch riêng từ `main`, giữ nguyên các thay đổi dirty/untracked hiện tại.
- Review `origin/feat/cloudinary-and-jaas` và `origin/feat/vu-hung-mobile-completion`; không merge nguyên branch vì có nhiều dependency native ngoài phạm vi.
- Chỉ nhận các phần cần thiết:
  - Native Jitsi adapter/config.
  - Certificate evidence upload.
  - Notification read-state và locale copy.
  - Contract/API fixes liên quan class detail, rating, notification.
- Đối chiếu lại với:
  - `docs/adr/ADR-015-mobile-client-expo.md`
  - `docs/adr/ADR-031-mobile-delivery-contracts.md`
  - `docs/plans/SkillSwap-SRS.md`
  - `tasks/todo.md`
- Cập nhật ma trận route–FR–screen sau khi source thực tế đã được xác nhận.

Commit riêng:

```text
docs(mobile): define completion matrix and simulator acceptance
```

## Phase 1 — Hardening app shell và release mode

Tập trung vào `apps/mobile/src/infrastructure/config.ts`, `apps/mobile/app/_layout.tsx`, session context và profile.

- Bỏ fallback mock âm thầm trong build release.
- Chỉ cho phép mock khi bật rõ biến môi trường dành cho test/demo.
- Thiếu Gateway URL phải hiện lỗi cấu hình, không được hiển thị fixture như dữ liệu thật.
- Kiểm tra login, refresh token, session restore, account switch, logout và unregister push.
- Hoàn thiện edit display name nếu endpoint profile đã được nhận từ branch backend.
- Kiểm tra locale VI/EN không bị trộn trên cùng màn hình.
- Kiểm tra font scale lớn, nút tối thiểu 44 px, không scroll ngang ở 360 px.

Acceptance:

- Fresh install → login → kill app → mở lại vẫn giữ session.
- Logout không còn device subscription cũ.
- Thiếu API URL hiển thị config error.
- Mock chỉ chạy khi được bật explicit.

Commit:

```text
fix(mobile): enforce explicit gateway mode and session safety
```

## Phase 2 — Hoàn thiện các flow nghiệp vụ đã có

Không xây lại marketplace/booking/wallet; chỉ đóng các khoảng trống runtime và negative path.

### Learner

- Browse → detail → hold → confirm.
- Chặn booking khi:
  - Chưa approved student verification.
  - Không đủ credit.
  - Class full.
  - Bắt đầu dưới 24 giờ.
  - Đã booking trước đó.
- Pending hold hết hạn phải reload/reconcile đúng.
- SePay:
  - Mở hosted checkout.
  - Hiển thị pending khi chưa settled.
  - Chỉ cập nhật balance sau server confirmation.
  - Không tạo debit giả ở client.
- Wallet history giữ pagination, trace/reference và integer credits.

### Verification và skill

- Student verification:
  - Chọn file.
  - Upload thất bại → giữ input và cho retry.
  - Rejected → resubmit tạo submission mới.
- Certificate evidence:
  - Chọn certificate type.
  - Upload qua signed target.
  - Submit `documentRef`.
  - Hiển thị history từng version.
- Verifier:
  - Queue đúng expertise.
  - Claim một lần.
  - Approve/reject với reason.
  - Không cho user thường truy cập queue.

### Teacher

- Tạo class với startsAt ≥ 24 giờ.
- Edit trước khi có confirmed booking.
- Chặn edit sau commitment.
- Cancel và hiển thị refund state đúng.
- No-show chỉ được gọi trong thời gian hợp lệ.
- Không để client tự tuyên bố class completed nếu server đã quyết định completion tự động.

Acceptance:

- Mỗi flow chạy một lần thành công trên Android Emulator và một lần trên iOS Simulator nếu native path hỗ trợ.
- Negative path chỉ chạy tối đa một lần cho mỗi lỗi chính.

Commit:

```text
feat(mobile): close verification transaction and teaching gaps
```

## Phase 3 — Native classroom và chat

### Native Jitsi

- Tạo adapter riêng cho `RoomAccessResponse`.
- Không cho phép client nhận room URL tùy ý; chỉ chấp nhận origin/provider đã cấu hình.
- Dùng token do backend cấp, không tự tạo JWT trong mobile.
- Mở native meeting modal/screen từ booking có `roomAccessEligible`.
- Hỗ trợ:
  - Learner join.
  - Teacher join.
  - Leave room.
  - Provider error.
  - Outside-window rejection.
  - Non-party rejection.
- Android cần camera/microphone permission.
- iOS cần `NSCameraUsageDescription` và `NSMicrophoneUsageDescription`.
- Không hardcode JaaS tenant nếu backend hiện tại đang dùng self-hosted Jitsi; target phải lấy theo provider config thực tế.

Files chính:

- `apps/mobile/src/infrastructure/http/room-access-gateway.ts`
- `apps/mobile/src/ui/my-bookings-view.tsx`
- `apps/mobile/src/ui/jitsi-room.tsx`
- `apps/mobile/app.json`
- `apps/mobile/app.config.js`

### In-class chat

Thêm `ChatGateway` dùng contract đã có trong `packages/contracts/src/chat.ts`.

API:

```text
GET  /api/classes/bookings/:bookingId/messages
POST /api/classes/bookings/:bookingId/messages
```

UI cần có:

- Message list oldest-first.
- Cursor/load earlier.
- Composer giữ nguyên draft khi network/403 lỗi.
- Polling nhẹ hoặc refresh thủ công; không cần realtime socket cho MVP.
- Chỉ learner/teacher của booking được đọc/gửi.
- Chat chỉ hoạt động trong room-access window.
- Render bằng text component, không render HTML/markup.
- Screen reader đọc được author, time và body.
- Không thêm content-blocking rule ngoài policy hiện hành.

Acceptance:

- Booking participant gửi/đọc được.
- Stranger bị 403.
- Gửi trước/sau window bị từ chối.
- Draft vẫn còn sau lỗi.
- Message dài/empty bị chặn client và server.

Commit:

```text
feat(mobile): add native classroom and booking chat
```

## Phase 4 — Rating và notification hoàn chỉnh

### Rating

Giữ form hiện tại nhưng bổ sung:

- Reset stars/comment theo từng booking.
- Chỉ hiện khi `ratingEligible=true`.
- Gửi đúng một lần.
- Duplicate/concurrent submit hiển thị trạng thái server.
- Reload lịch sau submit.
- Class detail chỉ hiển thị review fields nếu contract thực sự có dữ liệu; không tạo average/rating giả.

### Notification inbox

- Thêm mark one as read.
- Thêm mark all as read.
- Giữ `unreadCount` do server trả.
- Giữ cursor pagination.
- `unreadOnly=true/false` phải parse chính xác.
- Copy VI/EN lấy theo locale hiện hành.
- Tap notification phải qua auth/session readiness trước khi deep link.

### Push

Android Emulator:

- Permission granted.
- Permission denied nhưng inbox vẫn dùng được.
- Background/cold start tap mở đúng lịch hoặc class detail.
- Logout/rebind không giao notification của account cũ.

iOS Simulator:

- Kiểm tra inbox, local notification, deep-link routing và permission UI.
- Ghi rõ APNs remote push thật chưa được chứng minh trên simulator.

Commit:

```text
feat(mobile): finish rating inbox read state and push routing
```

## Phase 5 — Simulator QA và release evidence

Mỗi flow chỉ chạy tối đa **3 lần**:

1. Lần đầu: smoke test.
2. Lần hai: chỉ chạy lại nếu có lỗi có thể sửa ngay.
3. Lần ba: final confirmation sau khi sửa.

Nếu simulator bị treo:

- Restart simulator một lần.
- Rebuild/reinstall một lần nếu lỗi native.
- Nếu vẫn lỗi, dừng flow và ghi blocker; không lặp thêm.

Các flow nghiệm thu:

1. Auth/session restore/logout.
2. Student verification upload/reject/resubmit.
3. Skill evidence/verifier decision.
4. Marketplace/detail/booking.
5. SePay top-up pending/settled.
6. Wallet history.
7. Teacher publish/edit/cancel/no-show.
8. Jitsi join/leave.
9. Chat participant/window/error.
10. Rating one-shot/readback.
11. Notification inbox/read/deep link.
12. VI/EN locale.
13. 360 px/390 px/font-scale/accessibility.

Commands:

```bash
cd apps/mobile
npm test -- --runInBand
npm run typecheck
npx expo export --platform android
npx expo run:android
npx expo run:ios

cd ../..
pnpm verify
```

`pnpm verify` là gate cuối. Nếu lỗi ở web/backend không liên quan mobile, phải tách rõ thành blocker môi trường hoặc lỗi ngoài phạm vi; không gọi mobile hoàn tất chỉ dựa trên mobile Jest/typecheck.

Commit cuối:

```text
test(mobile): verify android and ios simulator release flows
```

## Definition of Done

- Mobile đáp ứng các FR liên quan Learner/Teacher/Verifier: FR-001–FR-013 và FR-016–FR-020.
- FR-014 withdrawal vẫn được ghi rõ là deferred.
- Admin operation vẫn dùng web.
- Không có mock fallback âm thầm trong release build.
- Jitsi native và chat chạy qua Gateway/contracts hiện hành.
- Android Emulator và iOS Simulator hoàn tất smoke matrix, mỗi flow không quá 3 lần.
- `pnpm verify`, mobile tests, typecheck và native builds có kết quả rõ ràng.
- Evidence phân biệt rõ:
  - source/test,
  - emulator runtime,
  - real-device limitation,
  - provider receipt,
  - production readiness.

## Baseline audit — 2026-11-11

Implementation branch: `codex/mobile-completion`, isolated worktree; original dirty checkout preserved.
Baseline: fetched `origin/main` at `ba38f80d87a5dcb50d336522d9012073aaf74803`.
The two proposed feature branches have already landed as squash merges (#101, #108).
Do not cherry-pick them again. API prefix is now `/api/v1` (ADR-042).

Verified source findings before implementation:
- SessionProvider already gates the app on resolveMobileConfig; missing URL raises ConfigurationError.
- Legacy api-config still describes mock fallback; audit call sites before changing it.
- Native Jitsi exists, but SDK loader accepts only functions (forwardRef objects need handling), errors silently hide invalid targets, and its text is English-only.
- Chat has shared schemas and backend routes but no mobile adapter/screen.
- Chat cursor is oldest-first and walks forward; UI must label pagination accurately instead of claiming it loads earlier records. ADR-036 permits history after class, only sends use the room window.
- Certificate upload, notification read state and profile update already have source on baseline; verify instead of duplicating.
- iOS Simulator available; Android SDK exists outside PATH. Native/provider acceptance remains unproven.

Execution phases retain the supplied order and separate commits: (0) this plan and matrix;
(1) config/session audit and any necessary hardening; (2) transaction/upload/teacher gap review;
(3) native room fixes and contract-backed booking chat with negative-path tests;
(4) rating/inbox/push review and fixes; (5) tests, exports, native builds and bounded simulator matrix.
For an already implemented phase, document verified evidence rather than creating artificial code changes.
Do not mark provider or device acceptance passed from unit tests. Each runtime flow has at most three attempts.

| FR | Route / screen | Initial evidence | Runtime |
|---|---|---|---|
| 001–002,017,019 | auth, profile, verification | existing source/tests; to rerun | pending |
| 003–005,018 | skills, verifier, teaching | existing signed upload/native picker | pending |
| 006–007 | explore, detail, bookings | existing source/tests | pending |
| 008–010,020 | wallet, checkout | existing server-confirmed flow | pending |
| 011 | bookings native room; teacher room | native source requires hardening | pending |
| 012 | booking chat | missing mobile surface | pending |
| 013 | booking rating | existing form; audit reset/readback | pending |
| 016 | inbox/device/deep links | existing read-state/push source | pending |
| 014 | withdrawal | deferred | excluded |
| 015 | admin | web only | excluded |

### Phase 1 source audit
App routes and UI contain no imports of mock gateways or calls to httpApiEnabled.
SessionProvider uses validated config and renders ConfigErrorView on missing/invalid URL.
Removed the unused httpApiEnabled toggle and misleading mock-first instructions; mocks remain test-injected only.
Existing session generation fences and logout's awaited device unregister are retained.
Profile display-name update and persisted locale are already wired. Runtime checks remain pending.

### Phase 2 source audit
Certificate selection, signed multipart upload, documentRef submission and history exist in SkillsScreen/SkillEvidenceGateway.
Upload failure does not clear the selected file and cannot submit evidence before storage succeeds.
Student verification and teaching already have dedicated negative-path suites. Teacher edit eligibility is finally enforced by the server commitment rule; class detail does not expose an irreversible commitment flag, so client must not infer it from availableSeats.
No manual completion command remains. Booking/wallet keep server-confirmation and reconciliation adapters.
Retain this implementation and rerun its suites; no new money or policy logic is required.

### Phase 3 implementation
Added shared-contract chat HTTP adapter and participant UI, manual refresh/forward pagination,
plain-text accessible messages, validation and preserved drafts on failure. Teacher entry uses
server-owned roster and class-level room access (ADR-040); learner entry uses booking-level access.
Jitsi accepts forwardRef SDK exports, shows invalid-target errors with an exit action, uses locale
copy and continues to use server-issued tokens with an allowlisted JaaS origin. Tenant comes from
validated backend URL; encoded path separators are rejected.
Initial post-change mobile run: 50 suites, 352 tests passed. This is source/test evidence only.

### Phase 4 implementation and checks
Rating form now owns state per account/booking, synchronously guards concurrent sends, resets
on success, and reconciles a server 409 duplicate instead of replaying a command. Server eligibility
still controls visibility. Existing notification one/all reads, cursor, server unread count and
locale copy remain covered by the inbox tests; app-shell push routing waits for auth/navigation.
Mobile checks after rating changes: 51 suites / 354 tests passed in full verify.
Full verify reached web tests but failed (12 files, 81 tests) under host Node 26, including
undefined localStorage.getItem; investigating the supported installed Node 24 before classifying.

### Phase 5 verified progress
- Full `pnpm verify` passed under installed Node 24.22.1 (Node 26 failed web tests because of Web Storage behavior). Mobile: 354 tests/51 suites at this point; contracts 258, API 1238, Gateway 37, web 517; architecture passed.
- Chat integration: 8/8 tests passed against isolated local Postgres/RabbitMQ. Covers unauthenticated/stranger refusal, participant read/write, closed windows, history, contact text and cursor. Harness substitutes outbound SePay; this is not a provider or simulator test.
- Additional room-route/encoded-target tests: 12/12 passed.
- Android Expo export passed. Android native debug APK built successfully on the second bounded attempt after stalled dependency downloads; 1426 Gradle tasks, build log `/tmp/skillswap-mobile-android-retry.log`.
- CocoaPods retry succeeded: 137 Podfile dependencies / 146 installed pods. iOS Simulator compilation and device smoke are in progress.
- Provider configuration check found missing Cloudinary credentials, JaaS key/private key and SePay credentials in the original local environment. User was asked for an alternative config path. No real provider acceptance claimed.
- Original checkout and its dirty documentation remain untouched. Local acceptance infrastructure uses separate Docker project `skillswap-mobile-acceptance`, Postgres port 55432, RabbitMQ 55672.

### Resumed acceptance with supplied provider configuration
User supplied `.env` and PEM files; imported with a private backup and verified matching JWT keypair.
The supplied database is remote. Acceptance API overrides database and broker settings to isolated local services;
no seed/reset is run against the supplied remote database.
Cloudinary HTTP smoke: signed target 201, upload 200 with asset receipt, local evidence submission 201,
history 200 and authenticated download target 200. Synthetic image only. Provider reports a different byte
count, so original-byte preservation is not claimed. This is not mobile picker/runtime evidence.
Android runtime attempt 1 reached VI login but input triggered an ANR. The single allowed cold-boot restart
also stalled: emulator log reports `detected a hanging thread 'QEMU2 CPU0 thread'`, and package-manager/input
commands did not finish. Stop Android flow retries per the supplied plan. No auth or business flow is marked
passed on Android; native debug compilation and APK installation are separate verified evidence.
Cloudinary signed download returned HTTP 200, image/png, 67 bytes. SePay checkout creation returned
201/pending with paymentUrl and unchanged balance; no actual payment or settlement was performed.
iOS native Debug Simulator build succeeded and app installed. First UI harness attempt stopped at
system deep-link confirmation before reaching login; second attempt handles that system dialog.
iOS attempt 2 reached boot error: Expo/SecureStore keychain access lacked an entitlement in the unsigned
Simulator build. One ad-hoc signing/reinstall repair was attempted. Attempt 3 was refused by Simulator
launchd (`FBSOpenApplicationServiceErrorDomain`, underlying POSIX 163). Stop auth flow at three attempts;
no iOS login, session, business, accessibility or provider-native flow has passed.

### Final gate and remaining packaging blocker
Final `pnpm verify` completed successfully under Node 24.22.1: mobile 357 tests / 51 suites,
contracts 258, API 1238, gateway 37, web 517; lint, build, typecheck and architecture passed.
Log: `/tmp/skillswap-mobile-final-verify.log`.
Android release packaging failed at `:react-native-gesture-handler:lintVitalAnalyzeRelease`
with JVM `Metaspace` exhaustion; no release APK is claimed. Log:
`/tmp/skillswap-mobile-android-release.log`. Simulator retry limits remain exhausted as above.
iOS Simulator archive is a local compilation artifact, not an accepted runnable release.
Native acceptance, Jitsi join/leave, remote push and SePay settlement remain unverified.

### Resumed Phase 5 — dedicated Android environment

The user authorized one additional environment repair and bounded test round (at most three
attempts per platform), then selected convenience and speed over platform preference. The
dedicated `SkillSwap_AI_API35` emulator is now the primary native target; the previous iOS
failures remain recorded. Gateway/Metro health and Maestro text-entry smoke passed.

Remaining execution phases, with separate meaningful commits:
1. **Native core acceptance:** authenticate an existing isolated-local fixture, restore after
   process death, browse/detail/book/confirm, inspect wallet and verification/teaching screens.
   Record each actual result and attempt count, including server readback. Use no remote reset.
2. **Native specialist acceptance:** exercise uploads, verifier, chat/rating/room/inbox and
   locale/accessibility paths with suitable local fixtures. A provider connection or remote
   push receipt is recorded independently from local/native behavior. Preserve every failure
   before diagnosing it. Any required code fix gets a focused regression test and commit.
3. **Final evidence:** update the tracked acceptance matrix with actual runtime evidence,
   verify internal package checksums, run `pnpm verify` under Node 24.22.1 and record remaining
   externally blocked acceptance. Do not infer settlement, APNs or production readiness.

The new round begins with Android auth attempt 1. No iOS retry is required for the Android
environment setup. Flows use small Maestro scripts and the dedicated serial `emulator-5580`;
do not restart a failed flow without a concrete repair or changed prerequisite.
