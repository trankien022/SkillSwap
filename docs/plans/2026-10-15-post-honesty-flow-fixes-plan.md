# Plan — Post-honesty fixes: role landing, auth chrome, payment return, booking flow

Status: **Proposed** — awaiting approval before any code
Owner: (agent) · Created: 2026-10-15
Related: `PRODUCT.md`, `DESIGN.md`, ADR-029/ADR-030 (roles), ADR-032 (event-driven settlement,
C3a/C3b), ADR-033 (SePay hosted checkout), ADR-018 (escrow settlement),
`docs/plans/2026-10-15-fr015-operations-dashboard-plan.md` (the FR-015 work that follows this).

> **Why this plan exists.** The honesty work (Phases 0–3) removed fabricated data, but four
> end-to-end defects remain that are *not* fabrication — they are missing or mis-wired flows.
> Each was reproduced against the running stack and traced to a specific line. **FR-015 must not
> start until these are fixed**, because two of them (an admin landing page, and the admin nav
> entry) are preconditions for the FR-015 dashboard being reachable at all.

---

## 1. Findings (all reproduced, 2026-10-15)

### Issue 1 — Login does not route by role; there is no admin landing page

**Observed.** Signed in as `admin@demo.skillswap.local` → landed on `/vi/classes`. The navbar
showed no admin or verifier entry whatsoever.

**Cause.**
- `apps/web/src/components/auth/AuthForm.tsx:116`:
  `const returnUrl = searchParams.get('returnUrl') || \`/${locale}/classes\`;` — a fixed default
  with **no role awareness**. The same line serves admins, verifiers and learners.
- **No `/admin` landing route exists.** `apps/web/src/app/[locale]/admin/` contains only
  `student-verifications/page.tsx`, `student-verifications/[verificationId]/page.tsx` and
  `verifiers/[accountId]/page.tsx`. There is no `admin/page.tsx`, and `verifiers/` has **no list**
  — only a detail page that must be reached by URL.
- The signed-in navbar (`navbar.tsx:111-157`) builds `navLinks` with no `admin` entry. Only
  `isVerifier` is checked (`:147`), so an admin sees the learner nav.

**Consequence.** Admin and verifier roles are unreachable from the UI. The verifier queue
(`/verifier`) and both admin pages exist but can only be opened by typing the URL.

### Issue 2 — The login page renders the full navbar

**Observed.** `/vi/auth?tab=login` renders `Khám phá → /vi/classes`, `Kỹ năng → /vi/skills`,
`Xác minh → /vi/verification`. Clicking any of them from a signed-out state opens an auth-gated
page.

**Cause.** `apps/web/src/app/[locale]/auth/page.tsx:4,24` unconditionally renders `<Navbar />`.
The guest branch of the navbar (`navbar.tsx:111-157`) correctly omits the signed-in links, but the
three links that are **always** present are all session-dependent:
- `/skills` — `dynamic = 'force-dynamic'`, fetches `GET /skills` and `GET /profile-skills/me`
  (both need a session; `skills/page.tsx:11-16`).
- `/verification` — mounts `VerificationContent`, session-dependent.
- `/classes` — `GET /classes` is authenticated (`ClassDetailContent.tsx:30`).

**Consequence.** The first thing a visitor does from the login page ends in a 401 dead end.

### Issue 3 — SePay returns to the ngrok host, and there is no payment-result page

**Observed.** `.env:78` `SEPAY_RETURN_URL=https://discuss-showbiz-octagon.ngrok-free.dev` — the
tunnel that fronts the **backend**, not the web app. There is no `/payment/result` route anywhere;
`apps/web/src/app/[locale]/payment/` does not exist.

**Cause.**
- `sepay-payment-gateway.ts:69,77-79` assigns the same `returnUrl` to `success_url`, `error_url`
  **and** `cancel_url`. SePay therefore bounces the payer to the API host regardless of outcome,
  with no success/failure distinction and no page to read.
- The checkout page's top-up flow (`checkout/page.tsx:229-261`) opens SePay in a **new tab**
  (`window.open(..., '_blank')`) and polls `GET /wallet/top-ups/:id` for up to 120 s. So on web the
  return URL is barely load-bearing *because* of the poll — but the new tab lands on the API root,
  which is a dead end for the user.

**Mobile.** Mobile has no top-up flow at all (no SePay reference under `apps/mobile/src`), so a
return URL pointing at a browser-only page cannot be honoured there. Any fix must not assume a
web page is the only consumer — see §4.P3.

### Issue 4 — Two booking buttons on one API; no balance gate; success asserted before settlement

**Observed.** On `/vi/classes/[id]` there are two CTAs:
- **"Đặt lớp"** — `BookingPanel` → `BookClassService.book()` → `POST /classes/:id/bookings`
  (`booking-panel.tsx:148`, `service.ts:14`, `http-gateway.ts:53`).
- **"Xem xét & Khóa ký quỹ"** — `<a href=".../checkout">` (`StickyBookingCard.tsx:119-134`) →
  checkout → `handleConfirmBooking` → **also** `POST /classes/:id/bookings`
  (`checkout/page.tsx:129-136`), then `POST /classes/bookings/:bookingId/confirm` (`:152`).

Both call the same create endpoint. Clicking "Đặt lớp" first creates a pending booking holding a
seat, so the checkout's POST then hits the `assertBookable`/duplicate guard
(`book-class.use-case.ts:38-61`) — precisely the reported "you are already in the class".

**Three separate defects:**

1. **Duplicate entry points.** One class, two buttons, one API. The learner cannot tell them apart
   and the second is guaranteed to fail after the first.
2. **No balance gate on the client.** The checkout page reads the balance
   (`checkout/page.tsx:53`) and derives `display` (`:108-111`), but `handleConfirmBooking`
   never compares `balance.availableCredits` to the price and the confirm button is never
   disabled. Affordability is used for copy only.
3. **Success is asserted before settlement — the money half.** `ConfirmBookingResult`'s own
   doc says `confirmed` "remains `false` while the request is pending wallet settlement"
   (`confirm-booking.ts:10-21`); `confirm-booking.use-case.ts:9-15` says there is **no synchronous
   payment claim** and the booking stays pending until Phase C3b. But the checkout page checks only
   `confirmRes.ok` (`:160`) and then sets `bookingConfirmed`/opens the success modal (`:166-168`).
   The real debit happens later in the `booking.confirmed` consumer
   (`wallet-ledger.module.ts:82-93` → `record-booking-confirmed.use-case.ts` →
   `sql-wallet-repository.ts:116-198`), where the balance check lives (`:183-198`,
   `InsufficientBalanceError` at `:197`). If that check fails, **the learner is already shown a
   success modal** and the ledger never moves — exactly the reported "auto accept without changing
   the wallet ledger".

**Mobile is the correct reference.** `apps/mobile/src/ui/class-detail-coordinator.ts` already
implements the honest model web is missing:
- `:304-320` marks `confirmed_success` **only** when `response.confirmed && booking.state ===
  'confirmed'`, otherwise reconciles by `GET` — spec `class-detail-coordinator.spec.ts:180`
  is literally *"never fabricates success when confirm returns confirmed: false and null
  booking"*.
- `:131-153` computes `isInsufficientBalance` from a real balance read and gates on it.
- The view renders "Confirm & Pay" **only** for an existing pending own booking
  (`class-detail-view.tsx:475-492`) and "Reserve" when `canBook` (`:494-501`).

Web should port this state machine rather than invent a second one.

---

## 2. Scope boundaries

1. **No API contract changes are required for issues 1–3.** They are client-side and
   configuration. Issue 4 needs **no new endpoint** either — the correct `confirmed`/`state`
   signals already exist; the web client simply ignores them.
2. **Issues 4's money defect is *surfacing*, not ledger logic.** The server already refuses to
   debit without funds (`sql-wallet-repository.ts:187`) and is idempotent (`:122-180`). This plan
   does **not** touch that code. It makes the client stop claiming success the server has not
   confirmed.
3. **No fake admin queue, no placeholder pages** (the standing rule). Issue 1 adds an admin
   *landing shell* that links to what exists; it does not fabricate the FR-015 lists, which stay
   in the FR-015 plan.
4. **Verifier role is separate from admin.** `isVerifier` already gates `/verifier`; this plan
   adds `isAdmin` and keeps the two independent.
5. **No CSS/design rework.** New chrome uses existing `DESIGN.md` tokens and existing components.

## 3. Binding decisions

### 3.1 One booking path — the checkout page becomes the only place that books
The detail page's "Đặt lớp" button **creates a hold only** and, on success, leads to checkout;
the checkout page **is** the confirm step. This matches mobile exactly (`Reserve` → `Confirm &
Pay`) and removes the duplicate-call failure. Concretely: `BookingPanel`'s `booked` state
(`booking-panel.tsx:142-146`) gains a real link into `/checkout`, and the redundant
`StickyBookingCard` CTA (`:119-134`) is removed rather than left as a second path.

### 3.2 The client's success claim must be earned by a server read-back
`confirmed_success` is asserted **only** when the confirm response says
`confirmed === true && booking.state === 'confirmed'`, **or** a subsequent
`GET /classes/:id` reports `ownBooking.state === 'confirmed'`. A `200` with `confirmed: false`
renders an honest *pending settlement* state and re-polls — never the success modal. This is a
direct port of `class-detail-coordinator.ts:302-320`; its existing specs are the acceptance
criteria.

### 3.3 Affordability is a gate, not copy
If `balance.availableCredits < priceCredits`, the confirm control is disabled and states the
shortfall with a link to top up. The server remains the authority; this only stops a learner
reaching a settlement that cannot succeed.

### 3.4 The SePay return URL is configuration, and the result page must degrade
- `SEPAY_RETURN_URL` points at the **web** origin (`http://localhost:3000` in dev).
- A **new** `/[locale]/payment/result` page reads the outcome honestly.
- **Critical:** SePay's hosted flow does **not** distinguish success from failure through one URL
  (`sepay-payment-gateway.ts:77-79`). The page therefore **must not** infer success from the
  redirect. It states that settlement is server-confirmed and either reflects the polled intent
  status or tells the payer to check the wallet. It is a landing page, not a receipt.
- Mobile cannot open a web page from the SePay redirect; the existing IPN + intent poll remains
  the only source of truth there (§4.P3 explicitly preserves that).

### 3.5 Role landing is data-driven
The post-login destination is chosen from `me.role` (already returned by `GET /auth/me`), with a
guard: an explicit `returnUrl` always wins, an unknown role falls back to `/classes`, and the
destination is never chosen from a value the client cannot verify.

## 4. Phase plan

Each phase = **one commit**; `pnpm verify` green at every phase (lint `--max-warnings=0`, build,
typecheck, vitest/jest, `pnpm test:arch`). Web test runner is **vitest**.

### Phase P1 — Role-aware landing + an admin entry that exists
*Fixes issue 1.*
- `navbar.tsx`: derive `isAdmin = me?.role === 'admin' || storedUser?.role === 'admin'` alongside
  the existing `isVerifier` (`:109`), and append an **Admin** link (→ `/${locale}/admin`) only for
  an admin. Keep verifier gating untouched.
- New route `apps/web/src/app/[locale]/admin/page.tsx` + `components/admin/AdminLanding.tsx`:
  a landing shell that links to `/admin/student-verifications` and `/admin/verifiers` **as they
  exist today**, states plainly which FR-015 views are not built yet, and refuses to render for a
  non-admin (honest forbidden surface, mirroring the Phase 2 pattern).
- `AuthForm.tsx:116`: after `authenticate()`, resolve the landing from the role returned by the
  session; `returnUrl` still takes precedence. Add a `postLoginPath(role, locale)` helper, unit
  tested for admin / verifier / learner / unknown.
- i18n: `Admin.Landing.*` added to **both** `vi.json` and `en.json` (parity test is in `verify`).
- Tests: `navbar.test.tsx` (admin sees Admin link; learner and guest do not; verifier link
  unchanged), `AdminLanding.test.tsx` (renders for admin, forbidden for learner, links correct),
  `AuthForm` role-redirect unit tests.
Commit: `feat(web): land each role on a page it can actually use`

### Phase P2 — Correct chrome on the auth pages
*Fixes issue 2.*
- Replace `<Navbar />` on `auth/page.tsx` with a **guest header**: brand mark + a link back to the
  public entry. This is the **only** page to fix: `login/page.tsx:9` and `register/page.tsx:9` are
  pure `redirect()` shims to `/auth?tab=…`, so they never render chrome.
- Keep the real `<Navbar />` on authenticated pages unchanged.
- Tests: assert the guest header renders **no** links to `/classes` (nav), `/skills`,
  `/verification`, `/bookings`, `/wallet`; assert an authenticated page still renders them.
Commit: `fix(web): stop offering signed-in navigation to signed-out visitors`

### Phase P3 — SePay returns to the app, with an honest result page
*Fixes issue 3.*
- `.env.example` + README + `docs/runbooks/sepay-ngrok-local-demo.md`: document
  `SEPAY_RETURN_URL` as the **web** origin and explain the tunnel still fronts the IPN.
  Set the local `.env` to `http://localhost:3000` (`.env` is gitignored — not committed).
- New `apps/web/src/app/[locale]/payment/result/page.tsx` +
  `components/payment/PaymentResultContent.tsx`: reads the intent if an id is present, otherwise
  renders the neutral "settlement is confirmed server-side; check your wallet" state. It must
  **never** derive success from the redirect alone and must never fabricate a balance change.
- **Mobile preservation:** document (in the plan + the phase's commit body) that mobile has no
  top-up surface, so nothing there depends on a web return URL; the IPN + intent poll stays the
  source of truth. No mobile code changes in this phase.
- Tests: result page renders neutral state without an id, settled state with one, failure state
  on a failed intent, and **never** a success claim from redirect parameters alone.
Commit: `fix(wallet-ledger): return SePay payers to the app and report honestly`

### Phase P4 — Collapse the two booking buttons into one path
*Fixes issue 4, defect 1.*
- `booking-panel.tsx`: on `booked`, render the real next step — a link into
  `/${locale}/classes/${classId}/checkout` — instead of a terminal "pending" pill alone.
- `StickyBookingCard.tsx`: remove the duplicate checkout `<a>` (`:119-134`); the single entry
  point is the booking panel.
- Guard the checkout page against being entered with an unknown/existing booking rather than
  blindly POSTing a second time: on mount, if `GET /classes/:id` reports an own pending booking,
  render the confirm step for **that** booking instead of creating another.
- Fix `classes/checkout/page.tsx`: it currently `redirect()`s to a **fabricated** class slug
  (`/classes/ielts-speaking-mock/checkout`), sending anyone who hits the bare checkout path to a
  class that likely does not exist. Send it to the real `/classes` list instead. (Found while
  writing this plan; it is a leftover of the same mock-data class the honesty pass removed.)
- Tests: one CTA on the detail page; a second booking attempt reuses the existing pending booking
  instead of POSTing again; the duplicate-booking toast is unreachable by clicking through the UI;
  the bare `/classes/checkout` path no longer redirects to a hardcoded slug.
Commit: `fix(web): make the class detail offer a single booking path`

### Phase P5 — Port the settlement-honesty state machine
*Fixes issue 4, defects 2 and 3.*
- New `apps/web/src/lib/booking/settlement.ts` (framework-free, mirrors
  `class-detail-coordinator.ts`): given the confirm response and a `GET` read-back, decide
  `confirmed_success` | `pending_settlement` | `confirm_unconfirmed` | `insufficient_balance`.
  Port the precedence from `class-detail-coordinator.ts:302-320` exactly.
- `checkout/page.tsx`: gate the confirm control on `balance.availableCredits >= priceCredits`
  (disabled + shortfall copy + top-up link); stop treating `res.ok` as success; on
  `confirmed: false` show pending-settlement and re-poll; only open the success modal on an earned
  `confirmed_success`.
- Reuse the existing top-up poll shape for the settlement re-poll; clear both timers on unmount.
- Tests (**the acceptance criteria**): parity with `class-detail-coordinator.spec.ts:180`
  (`confirmed: false` + null booking → **no** success), `:219` (success only on read-back
  `state === 'confirmed'`), insufficient balance disables the control and never calls confirm,
  and a settled-then-reread flow opens the modal exactly once.
Commit: `fix(web): claim a booking succeeded only once the server confirms it`

### Phase P6 — Mobile regression coverage for the flows touched here
- Mobile already behaves correctly for issues 1–4 (role gating `profile-view.tsx:102`, the
  coordinator, no top-up surface). Add **no behaviour**, only pins:
  a spec that the role-gated links are absent for a learner and present for
  verifier/admin (closing the earlier Phase 4 open item), and a spec that the top-up surface is
  absent so P3's web-only return URL is a recorded decision rather than an oversight.
Commit: `test(mobile): pin role-gated navigation and the absent top-up surface`

### Phase P7 — Docs close-out
- `docs/api/RESPONSE-CONVENTIONS.md` if P5's polling changes any documented code; the runbook and
  README from P3; a short note in `PRODUCT.md`/`DESIGN.md` only if a new user-visible pattern
  (the settlement-pending state) warrants a token or a copy rule.
Commit: `docs(web): record the booking settlement and payment-return behaviour`

## 5. Commit sequence

```
feat(web): land each role on a page it can actually use
fix(web): stop offering signed-in navigation to signed-out visitors
fix(wallet-ledger): return SePay payers to the app and report honestly
fix(web): make the class detail offer a single booking path
fix(web): claim a booking succeeded only once the server confirms it
test(mobile): pin role-gated navigation and the absent top-up surface
docs(web): record the booking settlement and payment-return behaviour
```

## 6. Definition of done
- `pnpm verify` green at every phase; no new lint warnings.
- Signing in as admin lands on `/admin`; as verifier on a usable page; as learner on `/classes`.
  An explicit `returnUrl` still wins.
- No signed-out page links to an auth-gated route.
- No page claims a booking was paid for unless the server has confirmed it; affordability gates
  the confirm control; the ledger remains the single source of truth (ADR-018/ADR-032).
- The SePay return URL targets the web app, and the result page never infers success from the
  redirect. Mobile's IPN+intent-poll path is untouched and documented.
- Exactly one booking CTA on the class detail page.
- i18n parity green; no fake queue or placeholder page anywhere.

## 7. Open questions
| # | Question | Blocks | Proposed default |
|---|---|---|---|
| Q1 | Verifier landings: should a `verifier` land on `/verifier` or on `/admin`? | P1 | **`/verifier`** — that is the queue their role can use; admins get `/admin`. |
| Q2 | Should the guest header keep a single link to `/classes`? | P2 | **No** — `/classes` is auth-gated, so the guest header links only to the public landing (`/${locale}`). |
| Q3 | Is the 120 s top-up poll long enough for a real bank transfer? | P5 | Keep it; the result page (P3) is the durable landing, and the wallet page always re-reads. |
| Q4 | What should `classes/checkout/page.tsx` do? | P4 | **Found while writing this plan:** it is not an orphan — it hardcodes `redirect(\`/${locale}/classes/ielts-speaking-mock/checkout\`)` (`:9`), a **fabricated class slug**. Any visit to `/classes/checkout` sends the user to a class that probably does not exist. Fix it in P4: redirect to the real `/classes` list (or 404), never a made-up id. |
