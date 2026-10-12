# Mobile feature-screen back navigation fix plan

## Problem

The Profile screen opens Student Verification, Skill Evidence, Teaching Classes, and Notifications as hidden routes inside the bottom-tab navigator. Those routes do not have a Stack header, so they render without a visible back action. Users can reach these features but have no clear in-screen way to return to Profile.

## Constraints

- Preserve Expo Router and the existing tab structure (ADR-015); do not change backend/API behavior.
- Keep the visual system from `DESIGN.md`: slate text, Campus Emerald for the action, surface/mist background, accessible tap target, and localized Vietnamese/English copy.
- Only add the back affordance to the four Profile-launched feature screens; retain current tab navigation and screen content.
- Handle both normal navigation history and a missing history entry by returning to Profile.

## Phases

### Phase 1 — Shared back affordance

- Add a reusable mobile UI header with a clearly labeled back button and accessible touch target.
- Use the current navigation history when available; otherwise replace the route with Profile so the screen never dead-ends.
- Add localized labels through the existing `Common` translation keys (Vietnamese and English).
- Keep styling aligned with existing mobile tokens and avoid altering feature content or API calls.

### Phase 2 — Apply to Profile-launched feature routes

- Render the shared header consistently on Student Verification, Skill Evidence, Teaching Classes, and Notifications.
- Verify each screen returns to Profile, including a direct-entry/no-history fallback.
- Run focused mobile tests, mobile typecheck/build, `git diff --check`, and the repository verification gate where practical.

## Acceptance criteria

- Each of the four screens has a visible, localized “Back” control with a minimum 44 px touch target and screen-reader label.
- Tapping it returns to Profile, including when no prior route is available.
- Existing screen content and data-loading behavior remain intact.
- Vietnamese and English strings both resolve; mobile typecheck and relevant tests pass.
