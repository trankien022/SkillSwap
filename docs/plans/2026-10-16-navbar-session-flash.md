# Navbar session rendering

## Cause
Navbar initially assumes a guest before browser storage is read in an effect. Ordinary navigation anchors reload the document, exposing that guest render on every page even with valid stored tokens.

## Phase 1 — fix and regression coverage
Represent unresolved session state separately from a confirmed guest. Render neutral account space until storage is checked, retaining server-provided account data when present. Use Next Link for internal navbar destinations to avoid document reloads. Test server markup, stored sessions across remounts with pending summary requests, and guest behavior.

## Phase 2 — acceptance
Run pnpm verify and browser navigation with delayed API responses; verify signed-in users never see the sign-in CTA during transitions, and guests still receive it after hydration. Commit implementation and evidence separately.

## Verified result
- Unresolved session renders neutral account space; confirmed guests retain sign-in. Stored profile remains available while auth/wallet summaries load.
- Navbar internal links now use Next Link.
- Added 3 regressions: SSR never claims guest before resolution; sessionStorage and localStorage accounts survive navbar remounts while API responses remain pending.
- `pnpm verify` passed; web 307 tests passed, architecture 899 modules / 2565 dependencies without violations.
- Chromium: signed in, delayed auth/me and wallet/balance responses by 800 ms, then navigated bookings/instructor/wallet/skills/verification/classes in VI and EN. All 12 transitions used client navigation and recorded zero sign-in CTA flashes. Also exercised full page entry for each locale.
