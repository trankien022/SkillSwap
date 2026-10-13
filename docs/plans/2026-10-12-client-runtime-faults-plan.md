# Client runtime faults — plan

> Date: **2026-10-12** · Branch: `feat/midterm-presentation-readiness`
> Trigger: four faults reported while running the dev stack side by side
> (web hydration mismatch, mobile `expo-notifications` red box, `api skills
> unauthorized`, `auth/me 500`, and the mobile "Cần cấu hình Gateway" panel).

## Reported symptoms and what each one actually is

| # | Symptom | Verdict | Root cause |
|---|---|---|---|
| A | React hydration mismatch on `/{locale}/classes` (`href="/en/classes"` vs `href="/vi/classes"`) | **Real bug** | `apps/web/src/components/navbar.tsx` derived the locale from `window.location.pathname`, which is `undefined` during SSR, so the server always rendered the `vi` fallback while the client rendered `en`. |
| B | `expo-notifications: Android Push notifications … removed from Expo Go with SDK 53` red box on the inbox screen | **Real defect (fragility)** | `apps/mobile/app/(features)/notifications.tsx` imported `expo-notifications` and `expo-device` at module scope. The inbox only needs HTTP; the native-module import alone crashed the whole screen. |
| C | `api skills unauthorized` | **Correct behaviour** | `SkillsController.list` rejects `'anonymous'` (`skills.controller.ts:33`). The request was unauthenticated. |
| D | `auth/me 500` | **Real bug** | `AuthController.me` does **not** guard `'anonymous'` the way every other controller does. `GetMeUseCase` looks up `accounts.id` (a `uuid` column) with the literal string `'anonymous'`; Postgres throws `invalid input syntax for type uuid`, which is not a mapped domain error, so `DomainErrorFilter` returns a 500. |
| E | Mobile "Cần cấu hình Gateway" panel | **Intended fallback, but under-signalled** | `EXPO_PUBLIC_API_BASE_URL` is unset, so `httpApiEnabled()` is false and the mobile gateways fall back to fixtures. Matches D5 in the parity matrix. |

Symptoms C and E are not defects. A, B and D are.

## Scope decision

The parity matrix already records D5 (`EXPO_PUBLIC_API_BASE_URL` unset → mobile
falls back to mocks). Symptom E is that disclosure surfacing in the UI, so **no
code change** is planned for E beyond what Phase 5 already documented.

Symptom C is correct behaviour and needs **no change**.

So this plan covers A, B and D. It is deliberately narrow: no refactor of the
identity model, no new guards on unrelated controllers.

## Phase R1 — Web navbar hydration (A)

The navbar is the only client component that derives the locale from
`window`. Replace it with `useLocale()` from `next-intl`, which resolves
identically on server and client.

- `apps/web/src/components/navbar.tsx`: drop the
  `typeof window !== 'undefined' ? window.location.pathname : ''` read; import
  `useLocale` and use it for both labels and hrefs.
- `apps/web/src/components/navbar.test.tsx`: wrap every render in
  `NextIntlClientProvider` (the component now needs locale context) via a
  `renderNavbar(props, locale)` helper, and add a regression test that renders
  in `en` and `vi` and asserts every nav href/label follows the provider
  locale. The test must **fail** against the pre-fix component to be worth
  keeping.

**Acceptance:** the new test fails on the old navbar and passes on the new one;
the full web suite stays green.

## Phase R2 — Mobile inbox survives without the push native module (B)

Keep push working on a development build, but stop the native import from
taking down a screen that does not need it.

- `apps/mobile/app/(features)/notifications.tsx`: remove the module-scope
  `expo-notifications` / `expo-device` imports; load both with `await import(…)`
  inside `enablePush`, which is the only place they are used. `expo-secure-store`
  and `expo-constants` stay top-level at the time of this phase.
  **Corrected 2026-10-13:** the `expo-secure-store` half of that sentence was
  wrong for Expo Web — see the parity matrix §14. The import was fine in Expo Go
  on a device, but every direct call throws in a browser, and this screen was one
  of five call sites affected. All now route through `defaultKeyValueStore()`.
- No behaviour change when push *is* enabled: same permission request, same
  token, same registration call.

**Acceptance:** the inbox renders and lists notifications in Expo Go; the
"Enable push" action still fails gracefully with the existing
`Notifications.pushError` message rather than crashing the tree.

## Phase R3 — `auth/me` must reject anonymous callers (D)

Match the convention already used by `NotificationsController`,
`SkillsController`, `MyBookingsController` and `ClassListController`: reject
`'anonymous'` with `401` at the controller boundary.

- `apps/api/src/modules/account-profile/internal/adapter/in/web/auth.controller.ts`:
  in `me()`, read `currentUserId(request)`, throw
  `UnauthorizedException('Authentication required')` when it is empty or
  `'anonymous'`, otherwise pass it to the use case.
- Add a controller test asserting `GET /api/auth/me` returns 401 (not 500) for
  an anonymous identity, and still returns the account for a real one.

**Deliberately out of scope:** `wallet/balance` and `student-verification`'s
`mine` have the same latent hole (they also pass `'anonymous'` into a uuid
lookup). They are listed in the follow-up below rather than fixed here, to keep
this change reviewable and to avoid touching wallet behaviour during the demo
freeze.

## Phase R4 — record the outcome

- Append the A/B/D findings and their fixes to the parity matrix as a short
  runtime-fault section, including the honest note that C and E were **not**
  bugs.
- Note the follow-up hole (wallet balance / student-verification mine) as an
  open item so it is not mistaken for fixed.

## Follow-ups (not in this plan)

1. Guard the remaining `currentUserId` call sites that feed a uuid lookup:
   `wallet-ledger` `GET /wallet/balance`, `GET /wallet/history`,
   `student-verification` `GET /student-verifications/me`, and the
   `skill-evidence` reads. A shared helper (e.g. `requireUserId(request)`)
   would remove the copy-pasted guard.
2. `D2` — duplicate mobile auth/wallet clients (still open from Phase 1).

## Verification

`pnpm verify` green (lint, build, typecheck, all suites, arch rules), plus the
new regression test for A demonstrated failing before the fix.
