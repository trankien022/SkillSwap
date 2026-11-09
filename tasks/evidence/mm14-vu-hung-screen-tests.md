# MM14 screen-test evidence — Vu Hung

Date: 2026-11-09
Branch: `feat/vu-hung-mobile-completion`
Base: latest `origin/main` `aa9039c`

## Added coverage

- `WalletView`: zero balance and empty history render after a successful read; VND-to-credit
  preview uses floor; fractional VND input is rejected before a top-up request; failed reads show
  an error and retry action.
- `DashboardView`: zero balance renders after a successful read; a failed account read is shown
  with a retry action.
- `TeachingScreen`: publishing is blocked before the request when skill, title, or description is
  missing. Existing MM13 picker/ISO assertions remain in the same view spec.
- `MarketplaceView`: a failed catalogue request renders an error with retry rather than the empty
  catalogue message.

## Verification observed

Command:

```text
pnpm --filter @skillswap/mobile test -- --runInBand src/ui/wallet-view.spec.tsx src/ui/dashboard-view.spec.tsx src/ui/marketplace-view.spec.tsx src/ui/teaching-screen.spec.tsx
```

Result: **4 suites passed, 11 tests passed**. Jest printed the existing `react-test-renderer`
deprecation warning; it did not affect the result.

MM12 source check: the latest main checkout already contains none of the three files named in the
assignment (`class-card.tsx`, `placeholder-view.tsx`, `src/ui/hung/session.tsx`,
`src/ui/hung/styles.ts`), and no imports reference them. No deletion was needed on this branch.

This records automated source-level tests only. It does not claim 360 px device/emulator or
screen-reader acceptance (MM15).
