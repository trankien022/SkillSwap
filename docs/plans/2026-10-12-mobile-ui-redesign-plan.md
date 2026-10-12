# Mobile UI redesign plan

## Goal

Refresh the complete SkillSwap Expo mobile interface into one cohesive, accessible design system while preserving the current Expo Router routes, API behavior, confirmed SRS requirements, and `DESIGN.md` brand rules.

## Design direction

- Use the existing SkillSwap “Honest Ledger” identity: mist background, white bordered surfaces, slate text, restrained Campus Emerald, semantic tinted statuses, flat elevation, pill primary actions, and system typography.
- Normalize the React Native token scale and expose shared primitives for page layout, section headings, cards, fields, buttons, status, empty/error/loading states, and icon-free labeled actions where the app has no icon library.
- Keep one primary action per screen, 44pt minimum touch targets, visible form labels, accessible labels, no emoji as functional icons, and Vietnamese/English parity.
- Keep the five existing bottom tabs and all secondary routes; do not alter business logic, endpoint calls, or add unsupported product features.

## Phases and commits

### Phase 1 — Design foundation and app shell

- Refine `apps/mobile/src/design/tokens.ts` with a consistent 4/8-based spacing, typography, radii, semantic surface/elevation, and control dimensions derived from `DESIGN.md`.
- Add reusable native UI primitives (page/screen shell, surface card, section header, primary/secondary/text action, labeled input, status/feedback, and empty state) with accessible defaults.
- Align root stack, tab bar, status bar, headers, safe areas, loading shell, and route-level backgrounds to the same system while retaining the current five-tab IA.
- Add focused tests for token invariants and shared primitive accessibility/touch-target contracts where testability supports them.
- Commit: `feat(mobile): establish unified UI foundation`.

### Phase 2 — Core learner and account journeys

- Apply the foundation to login/register, dashboard, marketplace/search/filter, class detail/booking, booking schedule/history, wallet/top-up, and profile.
- Preserve all existing interactions and data states; improve loading, empty, success, and error hierarchy consistently.
- Verify Vietnamese/English parity and 360pt layout without horizontal overflow.
- Commit: `feat(mobile): redesign core learner journeys`.

### Phase 3 — Verification, teaching, notification, and utility journeys

- Apply the same system to student verification, skill evidence, teaching management, notification center, and boot/config/placeholder states.
- Normalize shared list rows, status treatments, forms, and action hierarchy across the remaining routes.
- Preserve permission boundaries and clearly label unavailable or unsupported states without adding product behavior.
- Commit: `feat(mobile): redesign remaining mobile journeys`.

### Phase 4 — Review and verification

- Run mobile tests, typecheck/build, lint, and `pnpm test:arch`; inspect all changed states and ensure localized strings remain intact.
- Build and launch on the available iOS Simulator, inspect primary screens at phone width, fix visual defects, then rerun focused checks.
- Run `graphify update .` and record verification evidence in a documentation-only commit if necessary.
- Completion requires every mobile route/component to use the shared design language, checks to pass, and the Simulator launch to be confirmed; report any external runtime limitation explicitly.

## Acceptance criteria

1. All screens and shared components in `apps/mobile/app` and `apps/mobile/src/ui` follow one shared token/component system consistent with `DESIGN.md`.
2. Five-tab navigation, all existing routes, forms, booking/wallet behaviors, and API interactions remain functional.
3. Interactive controls meet the 44pt target, form labels stay visible, status is never color-only, and accessibility labels remain present.
4. Vietnamese and English remain complete and separate per screen; layouts fit 360pt width without horizontal scrolling.
5. Mobile tests, typecheck/build, lint, and architecture checks pass; iOS Simulator review is completed or its blocker is reported.

## Risks and constraints

- Scope spans many screens; implement shared primitives first to avoid inconsistent per-screen styling.
- `DESIGN.md`, confirmed SRS requirements, ADR-015, and the existing architecture remain authoritative over generic design suggestions.
- No new icon library, network integration, business rule, or unsupported push-notification behavior is added as part of this visual redesign.
