# Mobile completion plan — Vu Hung

Baseline: main `16ba1aa`. Work only on `feat/vu-hung-mobile-completion`.
Source: mobile remaining assignment (2026-11-07), reconciled with ADR-038/039.

## Scope update — latest main and user authorization (2026-11-09)

The user supplied a fresh main snapshot. Remote `origin/main` advanced to `aa9039c`
(`fix(mobile): sync mobile flows with API audit (#102)`), so merge it into this feature
branch before continuing and preserve its API-audit implementation and screen tests.
The user explicitly authorized implementing the missing MM8 API as part of completing
the assignment. Add authenticated display-name editing to `/auth/me`, wire mobile profile
editing through the session layer, and cover the endpoint, persistence, and screen with tests.
Use the current upstream MM14 screen tests and add coverage for profile editing. Attempt
MM9/MM15 checks on available emulator/device surfaces; never report physical-device results
without an observed run. If no suitable device, JaaS test account, or screen-reader setup is
available, leave those runtime acceptance items explicitly pending and report what is needed.

## Scope and commit phases

0. Commit this plan before implementation; install the locked workspace dependencies.
1. MM1: remove the obsolete complete action, route evidence and obsolete assertions;
   show translated automatic-completion guidance. Commit separately from rejection reasons.
2. MM1 rejection parity: publish the rejection vocabulary through contracts, consume it
   in backend/mobile and translate learner_not_verified; preserve module boundaries.
3. MM10: use the actual class title as the accessible detail heading. MM2/MM3:
   review existing title/rating reads and add only necessary regression coverage.
4. MM4/MM11: persist notification read state, use server unreadCount and server copy,
   preserve focus refresh, account isolation and locale handling; remove duplicate copy keys.
5. MM5: shared signed multipart upload helper, certificate selection/submission/history,
   owner/verifier document reads using existing B9 routes and contracts; test upload failures.
6. MM6: show the latest submitted school, major, date, status, reason and document reference.
   Explain pending/approved submission restrictions. No learner document read permission
   expansion and no new student-verification history API.
7. MM7: filter sheet; keyword/skill/date filters on server, supported response-field filters
   on accumulated results; disclose limited client scope; reset cursors and prevent stale loads.
8. MM12: confirm unused UI imports, remove orphan components while preserving test mocks.
9. MM13: shared date/time picker for create/edit; ISO serialization, locale labels and
   lead-time validation aligned with backend. Verify native dependency compatibility.
10. ADR-039: authenticated JaaS join through a compatible native integration; preserve
    tenant and token, handle permissions/errors, document native-build requirements.
11. MM14: focused screen tests for wallet, dashboard, publish guard and marketplace errors.
12. MM9/MM15: prepare dated device/push/JaaS/accessibility checklists and record only
    actually observed results. Leave unavailable physical-device/vendor checks pending.
13. Run focused tests and full pnpm verify, review diff and secret exposure, commit each
    meaningful phase. Report actual validation and limitations before pushing this branch.

## Explicit exclusions

- MM8 display-name editing remains deferred: no agreed API/product scope.
- No main branch modifications or merge; no database reset or demo reseeding.
- Historical MinIO evidence does not prove Cloudinary runtime acceptance.
- Do not mark MM2/MM3 device acceptance complete from source inspection alone.

## Acceptance

Each change preserves vi/en parity, 360px layout and status text plus colour.
No mobile command calls the removed completion route. Contract parsing and server-authoritative
money/state remain intact. Required checks: lint, build, typecheck, tests, architecture rules.
Runtime gaps must be listed separately from automated checks, with reproduction steps.
