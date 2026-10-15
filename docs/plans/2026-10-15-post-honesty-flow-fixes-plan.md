# Plan — Post-honesty flow fixes: role landing, auth chrome, payment return, booking flow

Status: **Proposed** — approved to start; decisions through round 3 (§0) recorded
Owner: (agent) · Created: 2026-10-15 · Updated: 2026-10-15 (round 3: booking flow redesign)
Related: `docs/plans/2026-10-15-fr015-operations-dashboard-plan.md` (P1 is its precondition),
`docs/plans/SkillSwap-SRS.md` (AC-022–AC-030, OQ-003, OQ-007), ADR-029/ADR-030 (roles),
ADR-032 (event-driven settlement C3a/C3b), ADR-033 (SePay hosted checkout), ADR-018 (escrow),
`docs/runbooks/sepay-ngrok-local-demo.md`.

> This **replaces the round-1 version** of this plan (commit `b074e64`). Round 1 answered
> "what is wrong"; round 2 recorded the decisions on each open point and folded in the two
> fabrication survivors found while answering (§1.5) plus the fields web was silently dropping
> (§1.6). Round 3 (D4/D5 + §2.3) redesigned the booking flow after it became clear there is **no
> synchronous credit-gate API**: one composite book → gate → confirm action on the detail page,
> with checkout demoted to the failed-balance branch.

---

## 0. Decision log (round 2, user-confirmed 2026-10-15)

| # | Question | Decision |
|---|---|---|
| D1 | Where do admin/verifier land after login? | Verifier → `/verifier` (their queue). Admin → a **new** `/admin` landing page (§4.1). |
| D2 | Navbar on the login/register page | **Remove all nav items** — brand header only. `login/` and `register/` are pure redirects, so `auth/page.tsx` is the only surface. |
| D3 | SePay return URL when both web and mobile exist | **Per-request `returnUrl`, allow-listed server-side.** Web sends `/{locale}/payment/result`; mobile sends `skillswap://wallet`. `SEPAY_RETURN_URL` is the default when omitted. The IPN + intent poll remain the source of truth on both clients. |
| D4 | Insufficient balance UX | **Gate inside the single detail action, after booking**: sufficient → confirm in place; insufficient → navigate to `/checkout`, where a `Nạp thêm credit` button appears (the gate's failure) opening the top-up modal already on that page; polling refreshes the balance, then confirm enables. |
| D5 | Class-detail button | **One composite action — book → balance gate → confirm.** No second button, no navigation CTA, **no "Đặt lớp" button** (the `Đặt chỗ` button *and* the `Xem xét & Khóa ký quỹ` link are both removed). Checkout is reached **only** when the balance is short. Working label for the composite button: `Xác nhận & Thanh toán` (one i18n key — trivial to rename). |
| D6 | Learner cancellation? | **None — by design.** AC-023: the MVP deliberately has no booking-cancellation policy. No endpoint or button to build; the hold expiry (§2.2) is surfaced instead. |
| D7 | Mobile top-up flow | **Already exists** (`wallet-view.tsx` + `wallet-service.ts`) — round 1 wrongly said it didn't. Scope for mobile is *return handling* only (P3). |

## 1. Findings (all reproduced, traced to source)

### 1.1 Login does not route by role, and no admin landing exists
- `AuthForm.tsx:116`: `returnUrl ?? \`/${locale}/classes\`` — one hardcoded default for every role.
  `authenticate()` already fetches `/auth/me` and stores the role (`api-client.ts:287-307`) but
  returns only `{ tokens }`, so the form never sees it.
- No `admin/page.tsx`. `apps/web/src/app/[locale]/admin/` has only `student-verifications/`
  (+ `[verificationId]`) and `verifiers/[accountId]` — both deep links; **verifier control has no
  list at all**.
- `navbar.tsx:111-157` builds no admin entry (`isVerifier` only).
- Live-verified: `admin@demo.skillswap.local` → `/vi/classes`, no admin/verifier link visible.

### 1.2 The auth page renders the full navbar
- `auth/page.tsx:4,24` renders `<Navbar />`; the guest branch keeps three always-on links
  (`navbar.tsx:133-144`): `/classes` (`GET /classes` authenticated), `/skills` (`force-dynamic`,
  two session fetches), `/verification` (session-dependent client fetch). Live-verified.
- `login/page.tsx:9` and `register/page.tsx:9` are pure `redirect()` shims — nothing else renders
  chrome on the signed-out path.

### 1.3 SePay returns to the ngrok host; no payment-result page
- `.env` `SEPAY_RETURN_URL=https://…ngrok-free.dev` (repo default: `.env.example:79`, empty) —
  the tunnel fronting the **API**, not the web app. No `payment/` route exists.
- `sepay-payment-gateway.ts:69,77-79`: one `returnUrl` config feeds `success_url`, `error_url`
  **and** `cancel_url` — no outcome is distinguishable through it, and both clients must share it.
- Web opens SePay in a new tab and polls (`checkout/page.tsx:229-261`); mobile opens the external
  browser (`wallet-view.tsx:178-182`) and polls (`:113-134`). In both cases the return URL only
  decides where the payer's browser *lands* — currently a dead API root.

### 1.4 Two booking buttons, one API; no balance gate; success claimed before settlement
- Class detail offers **"Đặt lớp"** (`BookingPanel` → `POST /classes/:id/bookings`,
  `booking-panel.tsx:148`) **and** "Xem xét & Khóa ký quỹ" (`StickyBookingCard.tsx:119-134` →
  checkout → same `POST` then `POST …/confirm`, `checkout/page.tsx:129-164`). First click holds a
  seat, so the second hits `assertBookable`'s duplicate guard (`book-class.use-case.ts:38-61`) —
  the reported "already in the class".
- Checkout reads the balance (`:53`) but never compares it to the price; the confirm button is
  never disabled (D4 fixes this).
- `confirm` answers HTTP 200 with `confirmed: false` by design (`confirm-booking.ts:10-21`; C3a),
  and the page checks only `res.ok` (`:160`) before opening the success modal (`:166-168`). The
  real debit runs later in the consumer (`wallet-ledger.module.ts:82-93` →
  `sql-wallet-repository.ts:183-198`, which throws `InsufficientBalanceError` at `:197`). A failed
  settlement therefore still shows success and moves no ledger row — the reported behaviour.
- Mobile already implements the correct machine (`class-detail-coordinator.ts:304-320`,
  `:131-153`; spec `class-detail-coordinator.spec.ts:180` *"never fabricates success…"*) — web
  ports it (§4.5), no second design.

### 1.5 Two hardcoded facts survived the honesty pass on checkout
- `checkout/page.tsx:484`: *"Thời gian còn lại **38 giờ 15 phút**"* — a static lead time presented
  as live data (real value = `startsAt − now`).
- `checkout/page.tsx:511`: *"Khóa **100** Credits trong Ví Ký quỹ"* — static price (real value is
  `display.priceCredits`, used correctly at `:660`).

### 1.6 Web silently drops `ownBooking` and `canBook`
- The contract carries both (`mobile-class-detail.ts:40-45, 65`) and the API fills them
  (`get-class-detail.ts:59`), but `mapContractDetailToWeb` (`api-class-detail.ts:23-67`) omits
  them and web's `ClassDetailView` (`types.ts:160`) has no such fields — zero matches for
  `ownBooking` in `apps/web/src`. Mobile reads both; web cannot see an existing hold. P4 threads
  them through.
- Note the trap: `canBook` is **false** when the caller already has a pending hold
  (`get-class-detail.query.spec.ts:307`), so a naive `canBook` gate would lock a learner out of
  checkout to pay. Hence the two-branch CTA in §4.4.

## 2. Ground truth for the questions asked

### 2.1 Do we have cancel booking? When can we cancel?
**There is no learner cancellation — deliberately.**
- **AC-023 / FR-007, OQ-003:** *"Given một booking, when Learner muốn hủy, then MVP không cung cấp
  hủy booking (không có chính sách hủy booking)."* A Confirmed requirement (OQ-003 resolved
  2026-10-08), not a gap. The domain's `CANCELLABLE_STATES`/`isRefundable` (`booking.ts:70-79`)
  exist for **system** transitions only.
- What cancels a booking, and when:
  1. **Pending hold expires (~15 min)** → auto-cancelled, seat released (AC-026, sweeper below).
  2. **Teacher cancels the class** → all affected learners refunded in app credits (AC-022,
     `POST /classes/:id/cancel`, `classes.controller.ts:137`).
  3. **Teacher no-show** (absent ≥15 min after start) → learner refunded, no penalty (AC-024,
     `bookings/:bookingId/no-show`).
  - A Confirmed→Cancelled transition refunds credits (AC-027, `refund-cancelled-booking.use-case.ts`).
- **No UI may offer a cancel button** (it would hit a route that does not exist). What the UI owes
  instead is the *expiry countdown* (§2.2), which web does not show today.

### 2.2 Does booking have a time check?
**Yes — exactly the 15 minutes you cited, plus more:**
- **Hold TTL:** `DEFAULT_HOLD_TTL_MS = 15 * 60 * 1000` (`booking.ts:57`, OQ-007 / AC-026):
  `computeHoldExpiry` stamps `expires_at = created + 15 min` (`book-class.use-case.ts:45`);
  `PendingHoldSweeper` (`adapter/in/scheduler/pending-hold.sweeper.ts`) cancels expired holds and
  releases seats; **confirmation of an expired hold is rejected in SQL**
  (`WHERE state='pending' AND (expires_at IS NULL OR expires_at > now())`,
  `sql-booking-repository.spec.ts:256`); expired holds stop counting toward capacity
  (`sql-class-list-reader.ts:152`).
- **Booking window:** ≥ **24 h** before start (`BOOKING_LEAD_TIME_MS`, `assertBookable`
  `booking.ts:184-186`), class not yet started, duration 30 min–3 h, capacity, self-booking
  forbidden, duplicate forbidden, full forbidden (`:161-198`).
- **The gap:** web shows only static copy (`vi.json:31` *"Xác nhận bằng cách nạp tiền trong 15
  phút"*) and **no live countdown**; mobile shows `ownBooking.expiresAt`
  (`class-detail-view.tsx:430-432`). P5 adds the countdown to checkout.

### 2.3 Is there an API that gates the credit check?
**No — no synchronous credit gate exists.** (asked 2026-10-15, round 3)
- **Book** does not touch the wallet: `booking.ts:4-6` — *"This phase owns booking eligibility … It
  does not touch the wallet."* `assertBookable` checks state / 24 h lead / duration / capacity /
  duplicate / self only (`:161-198`).
- **Confirm** does not either: `confirm-booking.ts:17` — *"There is no synchronous payment
  claim."* It emits `booking.confirmed {settled:false}` (C3a) and answers `confirmed: false`.
- The **only real balance gate runs asynchronously** in the wallet consumer, *after* the HTTP
  response: `UPDATE … SET available_credits = available_credits - $price WHERE owner_id AND
  available_credits >= $price`, else `InsufficientBalanceError`
  (`sql-wallet-repository.ts:182-198`). The client cannot observe that failure — precisely the
  reported "auto accept without changing the wallet ledger" (§1.4).
- **Consequence:** the gate must be composed client-side from two existing reads —
  `GET /wallet/balance` → `availableCredits` vs `priceCredits` from `GET /classes/:id`. No new
  endpoint (§3.1). The server's async gate remains the authority; the settlement machine (§4.5)
  surfaces its rare failure honestly.
- Making `confirm` check synchronously would require live-class to read wallet state across
  module/schema boundaries (ADR-014: no cross-schema; modules are coupled by events today) — an
  architecture decision needing its own ADR, deliberately out of scope here.

## 3. Scope boundaries

1. **No new endpoints.** P3 is a request-field addition to an existing endpoint; P4/P5 are pure
   client work against signals the API already returns. No ledger/settlement code changes — the
   server already refuses insufficient funds and is idempotent (§1.4).
2. **No learner-cancel feature** (D6/AC-023). If policy ever changes, that is a new SRS decision.
3. **No fabricated queues.** The `/admin` landing links only to pages that exist; the FR-015
   lists arrive with that plan (P1 is its precondition; FR-015's W4 extends the landing shell).
4. **Gateway untouched.** `api-proxy.service.ts` is a raw streaming proxy — the P3 contract
   change needs no gateway code.
5. **No design rework** — `DESIGN.md` tokens only; status shown as text + colour.

## 4. Binding decisions

### 4.1 Role landing (D1)
`postLoginPath(role, locale)` (unit-tested): `admin → /admin`, `verifier → /verifier`,
anything else / unknown → `/classes`; an explicit `returnUrl` always wins. The role comes from
`authenticate()`, which already fetched `/auth/me` — extend its return value with the role it
stored (`api-client.ts:301-307`) rather than issuing a second request. `/admin` landing: client
gates on `/auth/me` exactly like `VerifierStatusPage` (form for admin, translated forbidden for
others, sign-in prompt for anonymous), links to `/admin/student-verifications` (usable today) and
an "open verifier status by account id" control (honest: *no list exists yet* — FR-015 adds it),
plus the Admin navbar entry (`isAdmin` beside `isVerifier`).

### 4.2 Auth chrome (D2)
`auth/page.tsx` drops `<Navbar />` for a brand-only header: **no nav items at all**. Tests assert
zero links to `/classes`-as-nav, `/skills`, `/verification`, `/bookings`, `/wallet` on that page.

### 4.3 SePay return URL — per-request, allow-listed (D3)
- **Contract:** `topUpRequestSchema` (`contracts/src/index.ts:249`) gains
  `returnUrl: z.string().min(1).optional()`.
- **Server allow-list** (in the top-up use case, config-aware): omitted → `SEPAY_RETURN_URL`;
  allowed if origin ∈ **{`origin(SEPAY_RETURN_URL)`} ∪ `SEPAY_RETURN_URL_ALLOWED_ORIGINS`** — the
  explicit list plus the configured origin — **or** scheme `skillswap:`; otherwise
  **422 `VALIDATION_FAILED`** (never silently rewrite to an attacker-chosen URL). The list is
  configuration, never a request header: trusting `Origin` would make this an open redirect. It
  exists because in development the web client runs on `http://localhost:3000` while
  `SEPAY_RETURN_URL` is the public ngrok domain, so the single-origin rule would refuse the payer's
  own result page (found by probing the running API). The resolved URL flows through
  `InitiatePaymentRequest` into `buildCheckoutForm` (`sepay-payment-gateway.ts:69-79`), which stops
  reading config directly. A refused URL is resolved *before* the intent is created, so no
  unpayable pending intent is left behind.
  *(422, not 400: the body is well-formed and individually valid — one field is refused on
  policy. The plan originally said 400; corrected during P3.)*
- **Correlation, discovered in P3 (was missing from D3):** SePay's redirect carries nothing of its
  own, and `top_up_intents.id` does not exist when the checkout form is posted (the intent is
  created *after* the gateway call, `initiate-top-up.use-case.ts:35`). So `withProviderRef` appends
  the **invoice number** — already the IPN's correlation key — to the web return URL, and
  `GET /wallet/top-ups/by-provider-ref/:providerRef` (owner-scoped, same 404 semantics as the id
  route) lets the return page read *that* intent. A custom scheme is left untouched: it cannot
  carry a query and appending one would change which screen the OS opens, so the app re-reads its
  own pending intent on arrival instead.
- **Web:** `handleConfirmTopUp` passes absolute `new URL(\`/${locale}/payment/result\`,
  window.location.origin)`; new route `payment/result/page.tsx` +
  `PaymentResultContent` re-reads the balance and states settlement timing — it **never** infers
  success from the redirect (one URL serves success/error/cancel), with links to Ví / khám phá.
  If the sandbox shows SePay appends invoice/status params, pass them through and poll that
  intent (recorded upgrade path, §8).
- **Mobile:** `wallet-service.createTopUp` sends `returnUrl: 'skillswap://wallet'` (scheme already
  configured, `app.json:5`); expo-router deep-links it to the wallet screen, which re-arms any
  in-flight intent poll or refreshes the balance on arrival.
- **`SEPAY_RETURN_URL`** (`.env.example:79`, README:73, runbook) is re-documented as the **web
  origin** — it doubles as the allow-list base and the fallback.
- **Risk (§8):** SePay may reject custom-scheme URLs. Fallback: mobile omits `returnUrl` (web
  page or configured default); the poll is unchanged either way.

### 4.4 One composite action on the class detail (D5)
`StickyBookingCard` drops the `BookingPanel` render (`:117`) **and** the `Xem xét & Khóa ký quỹ`
link (`:119-134`). A single button performs the whole flow — *book first, then gate, then confirm*:

1. **Book (skip when already held):** if `ownBooking` is `pending` and not expired → reuse it;
   otherwise `POST /classes/:id/bookings` (idempotency key as today). Book rejections
   (`class_full`, `duplicate_booking`, `booking_window_closed` …) surface as the existing
   translated reason, never a redirect.
2. **Gate** (client-composed, §2.3): `availableCredits >= priceCredits`, from a fresh
   `GET /wallet/balance` (`callApiOk`, Phase-3 discipline) against `priceCredits` already on the
   page.
   - **Sufficient** → step 3.
   - **Insufficient → navigate to `/checkout`** — the hold exists by now, its 15-min countdown
     running. No confirm is attempted.
   - **Balance unreadable → also `/checkout`** (cannot gate ⇒ cannot honestly confirm); checkout
     re-reads and shows its own honest load-error state if it still fails.
3. **Confirm:** `POST /classes/bookings/:bookingId/confirm` → settlement machine (§4.5) →
   success rendered **in place** on the detail page, only when earned.
`canBook` + `ownBooking` are threaded through (`types.ts:160`, `mapContractDetailToWeb`
`api-class-detail.ts:23`, §1.6). With no active hold and `canBook === false`, the button is
disabled with a reason derived from data the client has (0 seats / state ≠ published / < 24 h /
own class) — facts, not placeholders. Demo fixtures get `canBook: false, ownBooking: null`.
Trap honoured: the pending-hold branch runs **before** any `canBook` test (§1.6 — `canBook` is
false exactly when the learner holds a seat).

### 4.5 Checkout = the failed-gate branch; settlement honesty (D4)
The checkout page stops being the mandatory step and becomes the page a failed gate lands on:
- **Arrival with a hold:** it re-reads the class; `ownBooking` pending → shortfall copy, live
  **countdown from `expiresAt`**, and the **`Nạp thêm credit` button shown immediately** (the
  gate failed — that is *why* the learner is there) opening the existing top-up modal
  (`:229-261`). The settle-poll refreshes the balance and re-runs the gate; sufficient → the
  confirm button enables.
- **Confirm:** `POST …/confirm` only (the hold exists). A direct visit with **no** hold runs the
  same book → gate code as §4.4 (shared helper), so the bare URL still works.
- **Settlement machine:** `lib/booking/settlement.ts`, pure functions ported from
  `class-detail-coordinator.ts:304-320` (spec parity with `class-detail-coordinator.spec.ts:180`
  and `:219`) — success only on `confirmed === true && booking.state === 'confirmed'`, **or** a
  read-back `GET /classes/:id` showing `ownBooking.state === 'confirmed'`. `confirmed: false` →
  *pending settlement* with re-poll; timeout → honest "đang xử lý / kiểm tra ví" state with
  links — **never** a success modal. Shipped in P4 (the detail action needs it), reused here.
- **Countdown expiry** → re-read the class → fresh state. No cancel button, ever (D6/AC-023).
- **De-fake §1.5:** the 24-hour remaining time derives from `startsAt`; `:511` reads
  `display.priceCredits`.

## 5. Phase plan

Each phase = **one commit**, `pnpm verify` green at each (lint `--max-warnings=0`, build,
typecheck, vitest/jest, `pnpm test:arch`).

### P1 — Role landing + admin landing shell
- `api-client.ts`: `authenticate` returns the stored role alongside `{ tokens }`.
- `AuthForm.tsx:116`: `postLoginPath(role, locale)` (§4.1), `returnUrl` precedence preserved.
- `navbar.tsx`: `isAdmin` beside `isVerifier` → **Admin** entry → `/${locale}/admin`.
- New `admin/page.tsx` + `components/admin/AdminLanding.tsx` (§4.1 pattern), honest
  "no list yet — FR-015" copy, `Admin.Landing.*` in **both** locales.
- Tests: `postLoginPath` matrix (admin/verifier/learner/unknown/returnUrl wins); navbar admin
  link present only for admin; landing renders for admin, forbidden for learner, sign-in for
  anonymous; links resolve to real routes.
Commit: `feat(web): land each role on a page it can actually use`

### P2 — Brand-only header on the auth page
- `auth/page.tsx`: replace `<Navbar />` (D2). Verify `login/`+`register/` remain pure redirects.
- Tests: auth page exposes no nav items; authenticated pages still do.
Commit: `fix(web): stop offering signed-in navigation to signed-out visitors`

### P3 — Per-request SePay return URL + payment-result page (web + mobile)
- Contracts: `topUpRequestSchema` + optional `returnUrl` (+ spec, `index.spec.ts:699` area).
- API: top-up DTO/use-case allow-list resolve (§4.3); `InitiatePaymentRequest.returnUrl`;
  `buildCheckoutForm` takes the request URL; specs (origin accepted, `skillswap:` accepted,
  foreign origin → 400, omitted → config, signature fields carry the resolved URL).
- Web: `handleConfirmTopUp` passes its URL; new `/payment/result` page (neutral, balance re-read,
  never success-from-redirect, i18n parity, tests for no-param and failed-poll states).
- Mobile: `wallet-service` sends `skillswap://wallet`; wallet view re-arms the poll/refreshes on
  deep-link arrival; spec asserts the URL is sent and the resume path polls.
- Docs in the same commit: `pnpm docs:api` (contract changed), `.env.example:79` comment,
  README:73, runbook.
Commit: `feat(payments): send SePay payers back to their own client`

### P4 — One composite book → gate → confirm on the class detail
- Thread `canBook` + `ownBooking` (§1.6) through `types.ts:160` + `api-class-detail.ts:23`;
  demo fixtures `canBook:false, ownBooking:null`.
- `StickyBookingCard.tsx`: remove `BookingPanel` usage + messages **and** the escrow link
  (`:119-134`); render the single composite button (§4.4). The detail view fetches its own
  balance via `callApiOk('/wallet/balance')` for the gate; gate-failure path → `router.push` to
  `/checkout`.
- New `lib/booking/settlement.ts` + specs mirroring `class-detail-coordinator.spec.ts:180/:219`.
- Delete `booking-panel.tsx` + its test after auditing `book-button`/`class-card`/`status-pill`/
  `lib/booking` for other consumers (V4) — delete only what is orphaned.
- Fix `classes/checkout/page.tsx:9`: hardcoded `ielts-speaking-mock` slug → redirect to
  `/classes`.
- Tests: sufficient balance → book then confirm called, success only when earned; insufficient →
  navigates to `/checkout`, confirm **never** called; balance read fails → navigates (no fake
  gate); existing pending hold → book skipped; book rejection surfaces its reason; `confirmed:
  false` never shows success; disabled state reasons; exactly one button; bare `/classes/checkout`
  no longer targets a fabricated slug.
Commit: `fix(web): book, gate and confirm in one action on the class detail`

### P5 — Checkout as the failed-gate branch
- Rework `checkout/page.tsx`: hold arrival via `ownBooking` (shortfall + live 15-min countdown +
  **`Nạp thêm credit` button appearing because the gate failed** → existing top-up modal →
  settle-poll refreshes balance → confirm enables); confirm-only path when a hold exists, full
  book → gate for direct visits (shared helper from P4); settlement machine reuse; every timer
  cleared on unmount; §1.5 copy derived from real data.
- Tests: failed-gate arrival shows `Nạp thêm` immediately and never claims success; after top-up
  settles the confirm enables and succeeds; countdown expiry re-reads to a fresh state; direct
  visit without a hold books first; no success claim from redirect params; price/lead-time values
  derived (the `38 giờ 15 phút` / `100 Credits` strings are gone).
Commit: `fix(web): make checkout the top-up branch of the booking flow`

### P6 — Mobile regression pins
- Pin role-gated links (verifier link present for verifier, absent for learner/admin) — closes
  the round-0 Phase-4 open item — and pin that no cancel affordance exists on mobile either.
Commit: `test(mobile): pin role-gated navigation`

### P7 — Close-out
- Flip this plan's status, cross-reference FR-015's W4 (extends the P1 landing shell),
  `pnpm docs:api` already done in P3.
Commit: `docs(web): close out the post-honesty flow fixes`

## 6. Commit sequence

```
feat(web): land each role on a page it can actually use
fix(web): stop offering signed-in navigation to signed-out visitors
feat(payments): send SePay payers back to their own client
fix(web): book, gate and confirm in one action on the class detail
fix(web): make checkout the top-up branch of the booking flow
test(mobile): pin role-gated navigation
docs(web): close out the post-honesty flow fixes
```

## 7. Definition of done
- `pnpm verify` green at every phase; no new lint warnings; i18n parity green.
- Admin lands on `/admin`, verifier on `/verifier`, learner on `/classes`; explicit `returnUrl`
  still wins; no signed-out page links to an auth-gated route; auth page has no nav items.
- Exactly **one** button on the class detail, performing book → balance gate → confirm; checkout
  is reached **only** when the balance is short (or by direct URL, which still works); an
  insufficient gate never calls `/confirm` and shows `Nạp thêm credit` on arrival; no fabricated
  slug route remains.
- No success claim without a server-confirmed settlement; affordability gates confirm; the 15-min
  hold is visible as a countdown; **no cancel button anywhere** (AC-023).
- SePay return URLs are allow-listed per client, `/payment/result` never infers success from a
  redirect, mobile deep-links back to its wallet, IPN + poll remain the only source of truth.
- No ledger code changed; no cross-schema SQL; no fake queue or placeholder list.

## 8. Verification items (resolve during the phase that needs them)
| # | Item | Phase | Fallback if the check fails |
|---|---|---|---|
| V1 | Does SePay accept a custom-scheme `success_url` (`skillswap://wallet`)? | P3 | Mobile omits `returnUrl` (web page / config default); poll unchanged. |
| V2 | Does SePay append invoice/status query params to the return URL? | P3 | If yes: `/payment/result` passes them through and polls that intent (upgrade path). If no: neutral page as specified. |
| V3 | Expo deep-links `skillswap://wallet` to the wallet route in practice (group segments are URL-invisible; typed routes on) | P3 | Add an explicit route/redirect; keep poll-based settle regardless. |
| V4 | Which of `book-button`/`class-card`/`status-pill`/`lib/booking/*` are orphaned after P4 | P4 | Delete only confirmed orphans; keep anything still imported. |

### Results

| # | Finding |
|---|---|
| V1 | **Accepted — no fallback needed.** A top-up sent with `success_url=skillswap://wallet` renders SePay's sandbox checkout normally (our invoice, our amount, no validation error), and SePay's own "Quay lại" link is literally `skillswap://wallet`. Mobile keeps sending its scheme. |
| V2 | **Nothing appended.** SePay's back link returned `…/payment/result?providerRef=<invoice>` exactly as submitted — it preserves our query and adds none of its own. So `/payment/result` needs no provider-supplied state: it reads the intent by the invoice number we put there, and settlement still comes only from IPN + poll. |
| V3 | **No extra route added.** `extractPathFromURL` maps `skillswap://wallet` to `/wallet`, and `(tabs)/wallet.tsx` already owns `/wallet` (group segments are URL-invisible), so the deep link resolves to the wallet screen that already re-reads on focus. A root `app/wallet.tsx` would have been a second route file for a URL that already has an owner — the very pattern Expo Router flags as `The route files … conflict on the route "/wallet"` — so it was dropped rather than kept as a redundant redirect. `app.json` already registers `scheme: "skillswap"`, so the link itself is registered. |
