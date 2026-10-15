# Contextual content and action deduplication

## Audit and boundaries
Review the main learner/teacher pages and shared composition: explore, bookings, teaching, class detail, skills, verification, wallet, notifications, publishing; inspect admin/verifier entry points. Preserve confirmation recaps, current status, validation and role-specific actions. Cross-page repetition is acceptable when needed for a decision; unrelated dashboard summaries and repeated policy cards are not.

## Phase 1 — consolidate repeated content
- Bookings sidebar: keep available/held credits and wallet link. Remove derived total/conversion/progress ornament and duplicated escrow policy paragraphs. Keep learner rules in an accessible collapsed disclosure rather than another permanently expanded panel.
- Class detail: remove the extra escrow banner; retain policy at the booking action. Remove the extracted partial refund badge that repeats the full refund row. Keep date/duration recap by booking as intentional decision support.
- Verification: replace the unrelated skills summary/count card with a compact link to Skills, and remove its redundant profile-skills request.
- Teaching: remove the repeated identity line already in navbar and duplicate skills-management action in the intro (keep section action).
- Publishing: remove the repeated blanket verification/schedule banner (live eligibility checklist and schedule field retain requirements); remove repeated pledge panel in checklist (publish warning remains).

- Withdrawal placeholder: retain one return-to-wallet action in the explanatory state instead of repeating it in the intro.

## Phase 2 — verification and report
Run pnpm verify, then browse changed pages plus unchanged core routes in VI/EN at phone/desktop widths, test disclosure and primary actions without submitting money or publishing. Record retained repetitions and scope limits. Commit code and validation separately.

## Audit decisions
| Page/flow | Decision |
| --- | --- |
| Explore | Keep category and advanced filters: they narrow different criteria. |
| Bookings | Compact wallet and collapsed learner rules; retain one Explore CTA in the empty state rather than duplicating it in the intro. |
| Teaching | Keep approved skill launch actions and class lifecycle controls; remove duplicate profile and intro Skills link. |
| Class detail | Centralize escrow copy beside booking; keep schedule recap at the committing action for context. |
| Skills | Approved/pending skills, evidence form and requested history represent different work and remain. |
| Verification | Keep student profile/status/upload; Skills is a compact cross-link without a second summary fetch. |
| Wallet | Keep balance, deposit conversion and ledger amounts: these support different financial checks. |
| Withdrawal | One return action; retain explicit unavailable-service explanation. |
| Notifications | Keep aggregate unread navigation cue and per-item read controls: different scopes. |
| Publish | Keep live preview, field guidance, eligibility and final warning; remove static banner and duplicate pledge. |
| Admin/verifier | Keep role-specific entry points and queue actions; no consolidation based only on similar layout. |
| Checkout/live/review | Retain booking/settlement recap and state-specific controls; no behavior changes. |

## Verification result
- Final `pnpm verify` passed: lint, build, typecheck, test suite (307 web tests), architecture with no warnings/violations (897 modules / 2563 dependencies).
- Chromium: 10 learner/teacher routes, VI/EN, 360/1440 px — 40 views, no horizontal overflow or squeezed SVGs. Includes real class detail, wallet/withdrawal, skills, verification and publishing.
- Learner rules open with Enter using native details/summary. Desktop bookings and phone verification visually inspected.
- After removing the duplicated bookings intro action, rechecked bookings at both widths/locales (4 views).
- No payment, publication, upload or administrative mutations were submitted. Admin/verifier and checkout/live/review content were reviewed in source; no claim of end-to-end acceptance for those flows.
