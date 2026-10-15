# Navbar session rendering

## Cause
Navbar initially assumes a guest before browser storage is read in an effect. Ordinary navigation anchors reload the document, exposing that guest render on every page even with valid stored tokens.

## Phase 1 — fix and regression coverage
Represent unresolved session state separately from a confirmed guest. Render neutral account space until storage is checked, retaining server-provided account data when present. Use Next Link for internal navbar destinations to avoid document reloads. Test server markup, stored sessions across remounts with pending summary requests, and guest behavior.

## Phase 2 — acceptance
Run pnpm verify and browser navigation with delayed API responses; verify signed-in users never see the sign-in CTA during transitions, and guests still receive it after hydration. Commit implementation and evidence separately.
