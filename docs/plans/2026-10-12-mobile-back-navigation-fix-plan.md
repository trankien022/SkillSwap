# Mobile feature-screen back navigation fix plan

## Problem

The Profile screen opens Student Verification, Skill Evidence, Teaching Classes, and Notifications as hidden routes inside the bottom-tab navigator. Those routes do not have a Stack header, so they render without a visible back action. Users can reach these features but have no clear in-screen way to return to Profile.

## Constraints

- Preserve Expo Router and the existing tab structure (ADR-015); do not change backend/API behavior.
- Keep the visual system from `DESIGN.md`: slate text, Campus Emerald for the action, surface/mist background, accessible tap target, and localized Vietnamese/English copy.
- Only add the back affordance to the four Profile-launched feature screens; retain current tab navigation and screen content.
- Model the four feature screens as pushed Stack routes so the back action always pops to the actual previous screen.

## Phases

### Phase 1 — Shared back affordance

- Move the four feature routes out of the tab navigator into a nested Expo Router Stack.
- Use the native Stack back button, with its back label localized through the existing `Common` translation key (Vietnamese and English).
- Keep styling aligned with existing mobile tokens and avoid altering feature content or API calls.

### Phase 2 — Apply to Profile-launched feature routes

- Open each feature route from its Profile menu entry and verify the Stack back button pops to the actual previous route.
- Remove feature routes from the tab navigator so they cannot masquerade as tabs or replace the originating route.
- Run focused mobile tests, mobile typecheck/build, `git diff --check`, and the repository verification gate where practical.

## Acceptance criteria

- Each of the four screens has the native, accessible Stack back control with localized back text.
- Tapping it returns to the screen that opened the feature, without redirecting to Home or another fixed destination.
- Existing screen content and data-loading behavior remain intact.
- Vietnamese and English strings both resolve; mobile typecheck and relevant tests pass.
