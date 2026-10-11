# Native build preparation — 12 October 2026

- User acceptance target: iPhone. Paid Apple Developer and Expo/EAS not configured yet.
- Added SDK-compatible native dependencies pinned to existing Expo 57 bundled versions: secure-store, dev-client, notifications, device, document-picker, file-system.
- Configured bundle id `com.skillswap.app`, existing URL scheme, SecureStore/notification plugins, EAS development/simulator/preview profiles; no fabricated EAS project id or signing credential.
- Local HTTP networking allowed for local development only; trusted HTTPS still required for physical-device deployment/Jitsi.
- Generated iOS project with `expo prebuild --platform ios --no-install`; CocoaPods installation passed. Generated native projects are ignored by Git, ESLint and dependency traversal; application source architecture rules remain active.
- Build attempt failed before compilation: Xcode 26.6 has SDK 26.5 but installed simulator runtime is iOS 27.0. An iOS 26.5 runtime download is in progress via official Xcode tooling; install/build evidence remains pending.
- No claim of installed build, physical push, two-device call or completed T02/T22.

Sources: https://docs.expo.dev/develop/development-builds/introduction and https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components.
