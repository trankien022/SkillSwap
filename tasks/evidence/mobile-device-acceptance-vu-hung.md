# Mobile device acceptance — Vu Hung

Status: **pending physical device run**. This file records the checklist; it is not evidence that a device check passed.

## MM9 — push and JaaS

Implementation precondition discovered 2026-11-09: the mobile app is on React Native `0.86.3`.
The official `@jitsi/react-native-sdk` release available in the npm registry is `13.3.0` and declares
peer support for `react-native: ~0.85.0`; its official setup also requires Android `minSdkVersion`
26 and a native build. This repo has no installed Jitsi SDK or native Jitsi view. Do not use
`Linking.openURL(access.url)` as proof of authenticated join: it does not pass the response token.
Resolve SDK compatibility/build configuration before running the two-participant acceptance. The
current branch does not claim that join flow works.
References checked: [Jitsi React Native SDK setup](https://github.com/jitsi/jitsi-meet/blob/master/react-native-sdk/README.md)
and [SDK package peer dependencies](https://github.com/jitsi/jitsi-meet/blob/master/react-native-sdk/package.json).

- [ ] Android physical device and build/version recorded.
- [ ] Background push received for a real class cancellation; capture time and notification.
- [ ] Tapping the notification opens the related booking/class after warm start and cold start.
- [ ] Booking cancellation and learner refund verified from the server/ledger exactly once.
- [ ] Two authenticated participants join the same JaaS room on separate devices; record teacher/learner role, audio, camera, and errors.
- [ ] Capture a dated recording or screenshots and attach the associated safe runtime logs.

## MM15 — TalkBack / VoiceOver

- [ ] Record device, OS, screen reader, app build and locale.
- [ ] At 360 px, traverse Wallet, Schedule and Class Detail using only the screen reader.
- [ ] Record labels, reading order, status text, error announcements, focus behavior and any clipping/overflow.
- [ ] Repeat in Vietnamese and English; log each issue with a reproduction step.

Environment probe on 2026-11-09: ADB started successfully, but `adb devices -l` listed no connected
device. The SDK has an AVD named `Medium_Phone`, but no screen-reader session or app runtime was
run. No box above is checked because no device acceptance was observed while preparing this branch.
