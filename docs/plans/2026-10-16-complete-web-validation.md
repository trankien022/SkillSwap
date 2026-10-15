# Complete web redesign — validation

## Design result

The complete Next.js client now follows the approved campus learning direction.
The homepage retains its online-learning scene. Product pages use compact,
illustrated introductions where learning context helps, consistent white/slate
panels, readable 14–16px controls, exact credit amounts and emerald actions.
Wallet and operator screens prioritize records and forms over illustration.

Taste Skill's existing-project workflow guided the audit and refinements.
PRODUCT.md / DESIGN.md take precedence over suggestions to swap fonts, add
texture/gradients, invent proof or animate controls with scale. Existing original
learning illustrations are reused; no stock portraits or fabricated class covers
were introduced. Catalogue illustrations are explicitly labelled as illustrations.
No extra animation or image library was added.

## Concrete improvements

- Auth: online-learning art, clear account heading, associated field labels,
  autofill metadata, larger controls and inline recovery guidance.
- Navigation: role destinations retained, profile opens verification, no invented
  unread count or unloaded zero balance, labelled controls and a skip link.
- Discovery: illustrated subject context/cards, honest remaining seats, clearer
  teacher/schedule/price. Group-class VND no longer divides an already per-learner
  credit price by capacity. Booking/payment calculations and API rules are unchanged.
- Learning: compact dashboard introduction, consistent session panels, localized
  guidance and review controls, keyboard focus/Escape/restoration in dialogs.
- Checkout: class information and exact payment summary replace decorative badges,
  unsupported encryption/support claims and dead links. Holds, settlement readback,
  balance gates, SePay handoff and polling retain their original implementation.
- Wallet: readable balances, top-up amount/total, provider-confirmed status,
  responsive transaction records and inline errors. No fabricated receipt export.
- Verification: actual student data/manual review replace sample identity, student
  number, fake card scan, fixed reputation score, completion rate and peer rating.
  No submission is presented as pending or approved without a real status.
- Withdrawal: real balance and an honest unavailable notice replace the simulated
  bank form, automatic Napas, tax claims and fabricated payout records.
- Teaching: skill-aware workspace, localized controls, preserved start/complete/edit
  operations, readable validation and an explicitly unpublished draft preview.
- Notifications: real inbox, proper error/empty distinction, category views and
  clearly session-only viewed marks. Removed non-persistent email settings.
- Operations: consistent admin/verifier forms and readable grouped decisions.
  Verifier queue has a single header. Status, error and unknown-route recovery
  have working navigation. Booking-less review redirects to the personal schedule.

## Route coverage

Every row applies to both `vi` and `en`. Dynamic routes use browser-only fixture
identifiers; these are not shipped as product data.

| Route under `/{locale}` | Design / expected behavior | Browser scenario |
|---|---|---|
| `/` | Existing approved learning homepage, keyboard skip link | Guest |
| `/auth` | Learning illustration and accessible login/register form | Both tabs, guest |
| `/classes` | Discovery introduction, search, filters, class cards | Guest and populated learner |
| `/classes/[id]` | Class information, teacher dossier, booking summary | Guest and populated learner |
| `/classes/[id]/checkout` | Class review, balance, payment and recovery | Populated learner |
| `/bookings` | Schedule workspace, live records, review actions | Guest and populated learner |
| `/bookings/[id]/live` | Online room/access status and controls | Real-shaped future booking; room unavailable |
| `/bookings/[id]/review` | Review and settlement workspace | Eligible completed fixture booking |
| `/wallet` | Credit summary, top-up and transaction records | Guest and populated learner |
| `/wallet/withdrawal` | Balance and explicit unavailable state | Learner |
| `/payment/result` | Missing intent and provider-confirmed result | No intent and settled fixture intent |
| `/verification` | Actual profile, upload prerequisites, manual review | Guest and approved fixture profile |
| `/skills` | Approved/pending skills and evidence form | Guest and populated learner |
| `/instructor` | Skills, schedule, classes and inline editor | Guest and populated teacher-capable learner |
| `/teach/classes/new` | Publish workspace and honest draft preview | Guest and approved-skill fixture |
| `/notifications` | Inbox filters and scoped viewed state | Guest/error and populated learner |
| `/admin` | Admin tools and verifier lookup | Admin fixture |
| `/admin/student-verifications` | Reference entry and review workflow | Admin fixture |
| `/admin/student-verifications/[verificationId]` | Grouped decision form | Admin fixture |
| `/admin/verifiers/[accountId]` | Verifier lifecycle form | Admin fixture |
| `/verifier` | Filtered evidence queue and claim/decision controls | Verifier fixture |
| `/status` | System probes with text states and navigation | Guest, intercepted health failure |
| `/[...rest]` | Branded localized 404 recovery | Unknown URL |
| `/login` | Redirect to localized auth login | Redirect contract |
| `/register` | Redirect to localized auth registration | Redirect contract |
| `/my-bookings` | Redirect to personal schedule | Redirect contract |
| `/classes/checkout` | Legacy checkout redirects to discovery | Existing unit regression |
| `/bookings/live` | Redirect to personal schedule | No invented booking |
| `/bookings/review` | Redirect to personal schedule | No invented booking |

## Evidence boundaries

Browser sessions and API responses are intercepted fixtures. They demonstrate
rendering, responsive behavior and named interactions; they do not prove real
credentials, inventory, payments, settlement, uploads, review decisions, push
notifications or a live Jitsi conference. Mutation checks, where used, stay inside
browser interception. No financial or operator command was sent to a real backend.

Notification viewed marks are intentionally local to the current page visit, as
stated in the interface. Withdrawal remains unavailable. Operator tools retain
the existing action-by-reference scope; no nonexistent administrative list or
new backend feature is implied. User-authored class names and server error
messages are preserved rather than rewritten as business facts.

Local screenshots, route results and interaction evidence are in:
`/Users/trankien/.codex/visualizations/2026/10/15/01a1405f-897a-7262-a6f0-990948da8826/complete-web/`.

## Final verification

- `pnpm verify` passed after the final implementation change: lint, builds,
  typechecking and **1,371 tests** (including 299 web tests across 41 files).
  Architecture checks found no violations across 893 modules and 2,547 dependencies.
- Production browser sweep: **136 route/locale/viewport combinations**, zero
  detected page errors, horizontal overflow or incomplete visible images.
  Both locales were checked at 360px and 1440px with guest and relevant role states.
- After the final rebuild: **24 tablet and alias checks** passed, covering six
  complex screens at 768px and six redirect routes in both locales.
- **10 mobile interaction checks** passed for authentication, discovery/menu,
  wallet conversion/validation, verification prerequisites and class editing.
  Verification accepts an empty optional major, matching the existing contract.
- Dialog checks passed for initial focus, Tab containment, Escape, focus restoration
  and keyboard skip navigation. No real mutation was submitted.
- Twelve final desktop/mobile screenshots and the six-screen overview were
  refreshed after the final rebuild. Visual review confirmed readable stacked
  controls, wrapped teaching actions and consistent typography, surfaces and CTAs.
  Icon cells reserve their width while the external icon font loads.

The complete sweep preceded the last icon-loading and optional-major corrections;
the affected screens were checked again by the final tablet, interaction and
screenshot runs. These are rendering and interaction checks with intercepted
browser data, subject to the evidence boundaries above.

Implementation and this report are committed locally on
`codex/web-design-refinement`. No remote push or deployment was performed.
