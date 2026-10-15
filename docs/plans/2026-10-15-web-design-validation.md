# Web design validation — 2026-10-15

## Result

The web client now uses a left-aligned student introduction, an explicit
learning journey, restrained class listings and a compact dashboard metric
strip. Navigation, auth and supporting surfaces follow the existing
slate/emerald system. Removed gradient class covers, floating decorative glow,
unattributed testimonials, disabled SSO promotion and the inert 24/7 support
button. Verification copy describes manual document review.

## Environment and evidence

- Local Next.js at `http://localhost:3000`, Chromium through the already
  installed Python Playwright 1.61.0. Browser plugin was not available.
- Viewports: 1440 × 900 and 360 × 800.
- Local screenshots and machine-readable reports are in this chat's
  `web-redesign` visualization artifact directory. They are not product assets.
- Guest checks intercept API calls with unauthorized responses. Catalogue and
  dashboard checks intercept API calls with contract-shaped fixtures. No test
  account or real financial action was used.

## Browser checks

| Check | Result |
|---|---|
| Meaningful main content and expected page title | Pass, 24 route/viewport combinations |
| Horizontal overflow | None in the checked combinations |
| Framework error overlay | None |
| Unhandled page JavaScript errors | None |
| vi/en locale switch and selected locale | Pass at both widths |
| Mobile navigation toggle | Opens the available route list |
| Auth tab switch | Registration fields render from the login screen |
| Catalogue with fixture data | Real fields render without decorative covers |
| Search submit | Request includes the submitted keyword |
| Optional filters | Open and close correctly at both widths |
| Dashboard with fixture data | Booking and wallet metrics render at both widths |

Guest sweep: Vietnamese home, auth, catalogue, bookings, wallet, verification,
skills, teaching and notifications; English home, auth and catalogue. Every
route was checked at both widths. Catalogue filters are closed initially so
phone users reach the results before the advanced filter form.

## Automated checks

`pnpm verify` passes: lint, production builds, typechecks, 1,352 tests across all
five packages, and architecture rules (876 modules, 2,479 dependencies).
All 280 web tests pass. Locale switch regression tests
now use the locale-less pathname returned by the localized router; the current
locale comes from the provider. Next.js reports the existing advisory about its
ESLint plugin configuration during build; ESLint itself passes with zero warnings.

## Practical limits

These checks verify rendering and the named interactions, not live backend
booking, payment, settlement, uploads or video calls. Operator screens,
populated wallet history, every booking lifecycle state, Safari and physical
phones were not exercised. Existing untranslated server-derived dashboard
policy text is outside this presentation change. No backend, contract or
architecture changes were made.
