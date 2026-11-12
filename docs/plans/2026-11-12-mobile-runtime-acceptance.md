# Mobile runtime acceptance — resumed 12/11/2026

Branch `codex/mobile-completion`. Primary runtime: dedicated Android API 35 ARM64,
debug app + Metro + authenticated Gateway. All data mutations in this round used isolated
local PostgreSQL/RabbitMQ, not the supplied remote database. Cloudinary and Expo/FCM were
real outbound services; uploaded PNGs were synthetic fixtures, not identity documents.

## Results by required flow

| Flow | Android evidence | Remaining scope |
|---|---|---|
| Auth/session/logout | Login passed after two harness input/selector failures and one corrected final attempt. Force-stop/reopen restored session. Refresh requests returned 200. Four UI logout/account switches removed the previous subscription. | Account creation and every expired-session error path are covered by tests, not this native round. |
| Student verification | Picker selected PNG; first upload failed without clearing input. After native file adapter repair retry returned pending. Admin rejected through authenticated HTTP; native resubmission created a distinct record/document; approval read back on device. | Synthetic fixture approval is local acceptance setup only; admin UI remains web. |
| Skill evidence/verifier | Native certificate picker/upload/documentRef/history passed. Native verifier2 queue showed the matching Python certificate; claim/approve persisted the correct reviewer. | Certificate authenticity is not tested. A second version and rejection UI were not exercised in this round. |
| Marketplace/detail/booking | Native browse/detail/hold/confirm persisted one booking. Wallet changed 1702 → 1542 for 160 credits; ledger recorded learner 160, teacher pending 144, fee 16. | Full/unverified/insufficient/under-24h/expired-hold matrix remains source/integration coverage. |
| SePay | Native checkout created 100,000 VND / 100-credit pending intent; wallet stayed 1542. | Hosted checkout completion, provider IPN and settled native top-up remain unverified. No real money transferred. |
| Wallet | Balance and history showed exact -160 credit debit and booking reference. | Native history pagination beyond the visible page not exercised. |
| Teaching | Native create/publish passed after trust stream repair; native edit before booking passed, server refused edit after confirmed booking. Native cancel refunded the fixture's full 10 credits. Final no-show on the correct active-window fixture `9b1db121…` persisted cancelled plus a matching 10-credit refund ledger entry. | The earlier no-show targeted the elapsed fixture and is not evidence for `6536dd6a…`. Final active-window fixture `9b1db121…` was tested correctly; no-show succeeded and refund was read back. |
| Jitsi | Initial teacher SDK loading failed. After navigation, modal and Worklets repairs, native learner and web teacher joined the same JaaS room, received each other's test video, and native leave removed the remote participant. See final acceptance below. | Final same-room media passed; native teacher-specific join remains unexercised after repair. |
| Chat | Native teacher sent, learner read/replied; both persisted. After advancing the local fixture past its window, history remained readable, send returned refusal and draft stayed intact. | Stranger/window/validation/cursor are additionally covered by existing 8-test integration suite; pagination and offline native draft are not claimed. |
| Rating | Native 5-star/comment submit persisted exactly one rating. GET class detail and native review section displayed the submitted comment. Server eligibility hid the submitted form on schedule reload. | Concurrent/duplicate behavior is component/backend coverage; no second native financial/class event is inferred. |
| Inbox/push/reminder | VI copy fixed, one-read changed 4 → 3, mark-all → 0, booking notification opened schedule. VI → EN → VI changed server inbox copy. Real verification outcome arrived via Expo/FCM on Android; tapping opened own verification and refreshed approved state. A seeded class reminder was visible/readable. | Cold-start push, every business notification type, native inbox cursor and a newly triggered reminder are not all accepted. Permission revocation killed Android process; reopened inbox worked. |
| Locale | Login, profile/navigation and notification content changed VI/EN correctly. | Entire screen/locale matrix remains incomplete; stored fixture titles/reasons retain original language. |
| Width/font/accessibility | Baseline 360 dp used throughout. Home rendered at 390 dp / font scale 1.5; a screenshot was saved and defaults restored. Chat messages expose author/time/body labels. | No full TalkBack, large-font form, 360/390 screen-by-screen accessibility acceptance. |

Native actions were executed in small Maestro flows. Selector/scroll failures are harness
failures, not successful business acceptance. No money/upload command was blindly retried.
The corrected document uploader retained the original form across its one failed submission.

## Regressions found and fixed

1. Class skill names: PostgreSQL `uuid = text[]` comparison silently omitted summaries.
   Fix compares `id::text`; 9 focused unit + 2 real-PostgreSQL facade checks passed; native
   detail displayed the actual Japanese skill.
2. Inbox locale: missing `Accept-Language` mixed VI chrome and English server copy.
   Locale now accompanies every page, stale page results are fenced, and locale changes
   reload. Inbox/gateway/translation targeted tests: 22 passed.
3. Signed upload: RN Blob rejects ArrayBuffer parts. Native uses an Expo cache File with
   exact view bytes and cleanup after success/failure; browser/Node retain Blob. Targeted
   student/certificate/native upload tests: 40 passed.
4. Trust ordering: independent producer/account counters collided and discarded an approved
   skill. Consumer keys separate event family and profileSkillId. Messaging unit tests: 23;
   PostgreSQL trust stream tests: 2. Only the one dropped local approval was replayed.

## Repository and package evidence

`pnpm verify` passed under Node 24.22.1 after moving a temporary diagnostics script out of
the lint tree. Mobile: 369 tests / 53 suites in the final handoff gate. Full gate includes contracts, API, Gateway,
web, lint/build/typecheck and dependency rules. Log: `/tmp/skillswap-final-handoff-verify.log`.

Android internal ARM64 release APK rebuilt with the final Jitsi repairs (80 seconds, 1856 tasks):
`artifacts/ai-simulator/SkillSwap-android-internal-20261112.apk`.
SHA-256: `6523b540c803a926bdbdabb23357b9a9a2bcc76710443a083a19d538636604d1`.
This is an internal local-HTTP package, not a production signing/deployment claim. The full business/media acceptance used the debug Metro client. Final APK was update-installed
successfully, launched independently and restored the user3 session; it is not a clean-install
full-matrix acceptance of this package.

38 successful Android HTTP method/route templates were observed in task API logs, filtering
`okhttp/` clients and 2xx/304 responses, excluding Python acceptance helpers. Repeated calls
are not counted as separate APIs. Sanitized summary:
`artifacts/ai-simulator/native-http-summary.json`. Route count is invocation evidence, not
proof of every requirement or negative path.

## Local artifacts

Screenshots and detailed local fixture IDs remain in ignored `artifacts/ai-simulator/`:
session restore (01), marketplace/detail/booking (02–07), wallet/history (08–09), SePay
pending (10), skill fix (11), inbox/read/logout (12–14), verification (16–17), remote push
(18), certificate history (19), verifier decision (21), Jitsi error (22), two-party chat
(23), closed-window draft (25), rating/readback (26–27), and 390-dp/font-150 home (29).
Screenshot 24 is a failed offline harness attempt; screenshot 28 must not be used to assert
the newly prepared no-show fixture passed.

FR-014 stays deferred. Admin operation remains web. iOS is outside the task per the user's Android-only instruction. SePay provider settlement, full accessibility, native teacher-specific
meeting smoke and production readiness remain outside the evidence accepted here.


## Final web–Android same-room acceptance (12/11/2026)

**Passed on the debug native client:** teacher user8 on isolated Chrome, learner user3 on
Android API35, distinct authenticated accounts. Both called the real Gateway and JaaS.
Class `8f965728-6b2c-4384-a45f-594ebaec2145`, booking
`1efcffb6-6da7-4b36-8d76-6e77859c6690`; only this synthetic local fixture was aged
into the room window after normal booking settlement. No remote DB was changed.

- Web teacher entered through the actual SkillSwap teacher page and JaaS prejoin.
- Android learner entered through schedule and native Jitsi prejoin. Both named the same
  room; the web conference exposed remote participant `Demo User 3`. Android displayed
  remote `Demo User 8`. These are provider participants, not the app's static roster.
- Web received unmuted remote video/audio tracks; remote video was playing, readyState4,
  540×960. Android displayed the green moving fake-camera image supplied by Chrome.
  P2P was active and native logs confirmed both JVB and P2P ICE connected.
- Native leave returned to schedule; web remote participants dropped to zero. Web teacher
  then left through the app action. No physical-camera or audible-speech claim is made: 
  Chrome used fake test media and Android used emulator camera/audio.
- Provider room-disco timeout and conference-creator metadata404 appeared before ICE
  recovered. They are retained as transient errors; successful media was observed after them.

Artifacts: `artifacts/ai-simulator/web-sees-android.png`, `android-sees-web.png`,
`cross-device-media.json`. The JSON stores only room/participant/track readiness, no tokens.

Three integration boundaries repaired:
1. Expo SDK56+ rewrites React Navigation core to a compatibility facade lacking
   `createScreenFactory`. Metro opts out using Expo's documented environment setting.
2. Jitsi JS navigators mounted native ScreenContainers inside React Native Modal, whose
   hierarchy has no ReactRootView. The pinned SDK patch disables native inactive-screen
   detachment only on its independent navigators. App navigation is unchanged.
3. Jitsi config parsing requires Worklets Core metadata; Expo's Worklets plugin produced
   incompatible metadata. A scoped Babel override compiles only Jitsi with Core's plugin.
   Its required proposal plugins are explicit dev dependencies. Three regression tests
   transform the actual SDK loader, preserve Expo's normal worklet transform, and load
   the Babel config without a filename as Metro does for cache keys.

Reference: [Expo migration](https://docs.expo.dev/router/migrate/sdk-55-to-56/#libraries),
[Jitsi sample Babel config](https://github.com/jitsi/jitsi-meet-sdk-samples/blob/master/react-native/babel.config.js).

Final full gate: `pnpm verify` passed (contracts258, API1242, gateway37, mobile369,
web517; lint/build/typecheck/architecture passed). Final release log:
`/tmp/skillswap-final-handoff-release.log`. The ARM64 APK is local acceptance packaging
with localHTTP/debug signing, not production distribution.

Final APK smoke: `adb install -r` succeeded, launching the actual release activity displayed
`Trang chủ` and `Xin chào, Demo User 3`. Metro was then stopped and the release activity was force-stopped/relaunched again;
Maestro asserted `Xin chào, Demo User 3` and `Trang chủ`. The bundled package restored
the existing session without Metro.
Only the release launch/session smoke is claimed; cross-device video was on debug.
