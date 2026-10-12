# Native build preparation — 12 October 2026

- User acceptance target: iPhone. Paid Apple Developer and Expo/EAS not configured yet.
- Added SDK-compatible native dependencies pinned to existing Expo 57 bundled versions: secure-store, dev-client, notifications, device, document-picker, file-system.
- Configured bundle id `com.skillswap.app`, existing URL scheme, SecureStore/notification plugins, EAS development/simulator/preview profiles; no fabricated EAS project id or signing credential.
- Local HTTP networking allowed for local development only; trusted HTTPS still required for physical-device deployment/Jitsi.
- Generated iOS project with `expo prebuild --platform ios --no-install`; CocoaPods installation passed. Generated native projects are ignored by Git, ESLint and dependency traversal; application source architecture rules remain active.
- The initial build failed before compilation because of missing compatible runtime/components. Downloaded iOS 26.5 runtime; user opened Xcode and completed first launch. Independently verified `xcodebuild -checkFirstLaunchStatus` exit 0 and CoreSimulator 1171.7.
- `expo run:ios --device 69A93AB7-0E1F-445F-A37E-A5C606E77DDC --no-bundler --no-install` succeeded: 0 errors, 1 generated Expo Dev Launcher script dependency warning. App `com.skillswap.app` installed on iPhone 17 Pro simulator (iOS 26.5), verified by `simctl get_app_container`.
- Metro initially bound only IPv6 localhost while native client requested IPv4 127.0.0.1. Restarted Metro with explicit IPv4 packager URL; status endpoint responds and native Hermes bundle loaded (1315 modules). Simulator screenshot shows the Vietnamese sign-in screen; the first-launch Expo developer menu was closed using its native closeMenu API through the local inspector.
- Evidence logs: `/tmp/skillswap-mobile-ios-build.log`, `/tmp/skillswap-mobile-metro.log`; screenshot `/tmp/skillswap-mobile-ios-auth-loaded.png`. A further inspector-driven probe invoked the actual native form input/submit handlers with a disposable account; real Gateway login succeeded and the native dashboard displayed the account and wallet data. Screenshot `/tmp/skillswap-mobile-ios-native-login-result.png`. This verifies native UI-handler/service integration, not a manual finger-tap test or all business flows.
- Native process restart restored the authenticated probe from SecureStore. Invoked actual context logout and separately verified both React session and authoritative session became null; the inspector returned a custom Promise object for the async command, so completion was verified in a separate runtime read. Manual tap/keyboard acceptance remains pending.
- No claim of physical push, two-device call or completed T02/T22. UI review and device interaction acceptance remain in progress.

Sources: https://docs.expo.dev/develop/development-builds/introduction and https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components.
