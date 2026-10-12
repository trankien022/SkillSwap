# Mobile rubric — task checklist

Tham chiếu: [plan](plan.md). Chưa triển khai. Mỗi task là một slice có thể verify; file paths là vùng dự kiến, phải thu hẹp khi thực hiện. Không tạo toàn bộ backend rồi mới nối UI.

## Phase 0 — contract/risk

- [ ] T01. Chốt 30 API/resource matrix và notification ownership ADR/SRS scope.
  - AC: 30 method+route duy nhất; FR Confirmed cho mỗi slice; ownership giữ 7 schemas và shared event contracts.
  - Verify: đối chiếu controllers/contracts/ADR; docs diff check.
  - Depends: none. Files: tasks/plan.md, SRS, một ADR mới phù hợp. Scope: M.
- [ ] T02. Spike push trên Android development build.
  - AC: máy nhận remote push và deep link có auth; biết credentials/native config còn thiếu.
  - Verify: device recording, không chỉ ticket status.
  - Depends: T01. Files: mobile app config, dependency config, push adapter PoC. Scope: M.
- [ ] T03. Spike Jitsi và server-only top-up/upload harness.
  - AC: phone reach HTTPS Gateway/Jitsi; hai participant test mic/camera; mock callback và upload chứng minh lưu thật.
  - Verify: device test + signed callback/reconciliation; credentials không ở app.
  - Depends: T01. Files: env example, test harness/Jitsi adapter; tách 3 spike nhỏ khi thực hiện. Scope: 3 x S.
- [ ] Checkpoint 0: review proposed policy/contracts; native/infrastructure blockers đã có kết quả thực.

## Phase 1 — app/session

- [ ] T04. Shell/tabs/locales/session storage.
  - AC: navigation 360px; vi/en parity; token storage/logout không lộ secret.
  - Verify: typecheck/build và manual auth screens.
  - Depends: T01. Files: app layout, auth routes, session port/adapter; chia shell và storage thành 2 task S/M. Scope: 2 x M.
- [ ] T05. Auth HTTP integration + account dashboard.
  - AC: register/login/me/refresh/logout dùng Gateway; refresh rotation single-flight; 401 dẫn đăng nhập đúng.
  - Verify: focused session tests + backend login/device restart.
  - Depends: T04. Files: auth service, HTTP adapter, auth UI, dashboard. Scope: M.
- [ ] Checkpoint 1: auth thật; build + pnpm verify green.

## Phase 2 — learner

- [ ] T06. Class list/search read API nối marketplace.
  - AC: lọc đã chốt/cursor; public-only/own teaching filter authorized; loading/empty/retry.
  - Verify: query/ownership tests và list screen với dữ liệu thật.
  - Depends: T01,T05. Files: class query port/adapter/controller, contract, marketplace; tách API và UI commits khi >5 files. Scope: 2 x M.
- [ ] T07. Detail read API nối màn lớp.
  - AC: Teacher public summary/seats; 404; không lộ private evidence.
  - Verify: response contract + detail screen.
  - Depends: T06. Files: detail query/adapter/contract/UI. Scope: M.
- [ ] T08. Top-up và wallet history.
  - AC: callback server-only; VND integer; provider pending không báo credited; pagination và refresh.
  - Verify: mock signed callback thực + đối soát ledger/wallet.
  - Depends: T03,T05. Files: wallet service/adapter/screens/harness. Scope: M.
- [ ] T09. Booking + confirmation nối flow có sẵn.
  - AC: giữ idempotency key retry; Pending/Confirmed/insufficient credit đúng; không có learner cancel.
  - Verify: 24h/full/self-book/duplicate/retry tests + phone booking.
  - Depends: T07,T08. Files: booking service/gateway/UI. Scope: M.
- [ ] T10. My bookings read API + lịch/dashboard.
  - AC: owner-only; status reconciliation; upcoming count chính xác ngoài first page.
  - Verify: ownership/pagination tests + command → dashboard cập nhật.
  - Depends: T09. Files: query/controller/contract/calendar/dashboard; chia API/UI nếu >5. Scope: 2 x M.
- [ ] Checkpoint 2: browse → top-up → booking → history trên phone, full gate green.

## Phase 3 — teaching

- [ ] T11. Student document submission/status/resubmit.
  - AC: upload bytes lưu thật; pending/reject/approved; resubmit tạo bản mới.
  - Verify: storage + authenticated admin decision → phone refresh.
  - Depends: T03,T05. Files: verification port/adapter/form/status. Scope: M.
- [ ] T12. Skill catalogue/read và evidence description/history UI.
  - AC: skillId/level từ catalogue; verifier quyết định đúng quyền; history giữ version cũ.
  - Verify: catalogue contract + seeded verifier claim/decision và phone.
  - Depends: T11. Files: catalogue API/contracts + evidence UI/adapter; chia catalogue và evidence 2 task. Scope: 2 x M.
- [ ] T13. Create/publish class UI.
  - AC: confirmed verification + đủ approved skills mới publish; duration/price/capacity validated server.
  - Verify: verified/unverified/insufficient-level tests và tạo lớp thật.
  - Depends: T12,T06. Files: teaching service/adapter/form. Scope: M.
- [ ] T14. Teaching dashboard/edit/cancel.
  - AC: own list counts; edit locked sau Confirmed; cancel cho learner refund đầy đủ đúng một lần.
  - Verify: two-account flow + ledger reconciliation; pnpm verify.
  - Depends: T13,T09. Files: teaching UI/service/dashboard; chia dashboard và edit/cancel khi cần. Scope: 2 x M.
- [ ] Checkpoint 3: evidence → approval → publish → book → cancel/refund chạy thật.

## Phase 4 — classroom/rating

- [ ] T15. Room access/start/complete mobile.
  - AC: JWT room đúng và access window/party; Teacher entry đã chốt; complete → release đúng.
  - Verify: hai thiết bị, outsider/time-window reject + pending→available.
  - Depends: T03,T10,T14. Files: room port/adapter/UI và teaching actions; chia room và completion. Scope: 2 x M.
- [ ] T16. Rating endpoint + form/result.
  - AC: eligible completed booking, own learner; unique rating enforced database/concurrency; comment đọc lại trong class detail.
  - Verify: duplicate concurrent submissions/non-owner/incomplete denied + phone rating.
  - Depends: T15,T07. Files: live-class rating domain/use-case/persistence/controller/contract + UI; chia backend logic, REST/read projection, UI thành 3 task ≤5 files mỗi task. Scope: 3 x M.
- [ ] Checkpoint 4: class live → completion/release → rating; full gate green.

## Phase 5 — notifications

- [ ] T17. Device registration/unregistration APIs + mobile lifecycle.
  - AC: owner-bound upsert/rotation; logout thiết bị hủy subscription; permission denied vẫn dùng app.
  - Verify: two accounts same device + ownership tests.
  - Depends: T01,T02,T05. Files: device persistence/application/controller/contracts + mobile adapter; chia backend/UI. Scope: 2 x M.
- [ ] T18. Durable inbox/events + list UI.
  - AC: source-event handoff durable; consumer dedup; list owner-only/cursor; deep link auth lại.
  - Verify: retry event không duplicate; outsider denied; inbox backend reload.
  - Depends: T17,T10,T12,T14. Files: account-profile inbox consumer/persistence/query/controller + UI; chia persistence/consumer, REST, UI. Scope: 3 x M.
- [ ] T19. Push dispatch/ticket/receipt.
  - AC: retry/backoff; invalid token disabled; payload không lộ dữ liệu; five base business outcomes mapped.
  - Verify: real phone foreground/background/cold start và correct deep link; receipt chỉ provider evidence.
  - Depends: T18. Files: dispatch port/adapter/durable delivery worker/config. Scope: M.
- [ ] T20. Class-start reminder.
  - AC: agreed offset; cancelled class không nhắc; retries/restart không gửi duplicate theo logical reminder.
  - Verify: controllable clock, cancellation/race/restart tests + device reminder.
  - Depends: T19,T15. Files: schedule reminder/application/adapter/contracts if approved. Scope: M.
- [ ] Checkpoint 5: notification event → inbox → actual phone push; pnpm verify green.

## Phase 6 — acceptance

- [ ] T21. Error/offline/session/async regression.
  - AC: no duplicate money effects; expired session/deep links safe; offline writes có hướng xử lý rõ.
  - Verify: relevant API+mobile focused tests, manual 360px/vi/en/accessibility; final pnpm verify.
  - Depends: T20,T16. Files: affected service tests + justified bug fixes only. Scope: split each found issue S/M.
- [ ] T22. Installable build + evidence rubric.
  - AC: Android APK cài được; 30 APIs app actually invokes; ≥5 resources persisted; dashboard + five flows + push video.
  - Verify: clean install against staging/dev HTTPS; git diff --check; graphify update . sau code.
  - Depends: T21. Files: build config + docs acceptance matrix/demo guide. Scope: M.
- [ ] Checkpoint final: full gate green, device evidence đủ, limitations mock payment/remaining SRS FR ghi rõ.
