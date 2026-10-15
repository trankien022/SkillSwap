# Complete web workspace redesign

## Scope and design contract

Continue the approved campus learning direction through every canonical Next.js
screen. Keep PRODUCT.md / DESIGN.md: system sans, slate/emerald, 360px minimum,
flat surfaces, pill primary actions, clear integer credit amounts, and no invented
verification, identity, ratings or financial state. The homepage is retained.
No backend, contract, role, booking lifecycle, payment or upload protocol changes.
Use Taste's existing-project workflow; brand rules override its font/gradient,
scale-hover and invented-content suggestions. Use the existing local learning
illustrations where they explain learning, not as fake course covers or people.

## Audit

Navigation is crowded and has an invented unread count; profile links to system
status. Auth has tiny labels and no learning imagery. Catalogue lacks visual
connection to the campus. Detail/publish pages contain static claims unrelated
to API state. Dashboard has English/Vietnamese literals and tiny metadata.
Wallet, teaching, notifications and verification have one-off visual hierarchies,
blocking alerts and untranslated labels. Verification falls back to a fabricated
student identity. Operator forms need readable grouping and narrow-screen flow.

## Phase 1 — Shared workspace and access

Add reusable page-intro, status/panel and form styles, skip navigation and a
consistent responsive header. Replace fake unread state with an honest default;
route the profile to verification. Redesign auth using the online-learning scene,
proper field labels, readable controls and preserved auth behavior.
Commit this phase after web tests/typecheck. Acceptance: guest/role navigation,
keyboard use, real auth fields and no mixed locales in new copy.

## Phase 2 — Browse and learn

Redesign catalogue/search/class cards using illustrative subject context (never
presented as course imagery); class detail and checkout with a clear information
column and booking summary; dashboard/session/review/classroom with a consistent
learning workspace. Keep real availability, holds, eligibility and API errors.
Commit this phase after web checks. Acceptance: filters/booking guards unchanged,
clear schedule/price, usable 360px controls, localized empty/error states.

## Phase 3 — Wallet, trust and teaching

Apply the workspace to wallet, withdrawal, payment result, verification, skills,
teaching studio and publishing. Remove fabricated identity/preset credentials;
replace blocking UI alerts with inline feedback. Localize touched user-facing
copy in both languages, preserving server messages without inventing state.
Commit this phase. Acceptance: amounts and fees unchanged, uploads/publishing
still use existing APIs, no success or verification implied without evidence.

## Phase 4 — Operations and completion

Redesign admin landing, student-verification queue/review, verifier status form,
skill-review queue and system status; add helpful branded not-found/error states.
Create a route coverage matrix (including redirects) and inspect every canonical
route in VI/EN at 360px and desktop, with tablet checks on complex screens.
Use browser-intercepted contract fixtures for populated/role states; no real
financial or operator mutations. Check keyboard, form errors, responsive data,
focus and images. Run pnpm verify. Commit implementation and validation report.
Preserve unrelated untracked files. No push or deployment is requested.
