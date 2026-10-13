# FR-008 — Phases 7 & 8 addendum (poll endpoint, UI, reconciliation stub)

> Date: 2026-10-14 · Branch: `feat/fr-008-sepay-payment-gateway`
> Parent plan: [2026-10-13-fr008-sepay-payment-gateway-plan.md](./2026-10-13-fr008-sepay-payment-gateway-plan.md) §9 Phases 7–8
> ADR: [ADR-033](../adr/ADR-033-wallet-topup-sepay-payment-gateway.md)
> Scope: **FR-008 / API-006 only.** FR-014 (payout) stays open.

## 0. Starting state (verified by reading the code, not assumed)

Already done in Phase 6 and pushed (`24dd189`):

- Both clients call `POST /wallet/top-ups` and `window.open()` / `Linking.openURL()` the returned
  `paymentUrl`. Design B means the client needs no signing material.
- `TopUpIntentRepository.findById(id)` already exists and is implemented in
  `sql-top-up-intent-repository.ts`. No new persistence work is needed.
- The gateway already treats `/api/wallet/top-ups/callback` as public and forwards it.

What is actually missing:

- **No poll endpoint.** `GET /wallet/top-ups/:id` does not exist, so a client cannot ask "did this
  settle?" and the user must click a manual "I have paid" button.
- **Web `wallet/page.tsx` still renders mock banking UI** that is now misleading, because it
  claims a bank, an account number and a transfer memo that no longer describe reality:
  - a placeholder QR box (`qr_code_2` icon, "Quét bằng Mobile Banking bất kỳ");
  - a hardcoded account `1049281772` with a copy button and "Vietcombank CN TP.HCM";
  - a hardcoded memo `SSWAP 3928` with a copy button;
  - a fake bank radio group (`VCB` / `MB` / `MOMO`) whose `bank` state is sent to no one;
  - copy that says the QR is bound to a named student, `SSWAP-3928`.
  These are hardcoded values presented as live payment instructions. This is the same class of
  defect as the two already fixed: UI asserting something the system does not do.
- **No polling in either client.** After checkout, the balance only updates on a manual click.
- **No reconciliation stub.**

## 1. Phase 7 — poll endpoint + real UI

### 7.1 `GET /wallet/top-ups/:id` (new, owner-scoped)

- New use case `GetTopUpIntentUseCase` behind port `GetTopUpIntentPort` (`GET_TOP_UP_INTENT`),
  following the existing `get-wallet-balance` shape.
- **Owner-scoped**: the intent is fetched by id and then checked against `currentUserId`. A
  mismatch returns **404**, not 403 — a 403 would confirm the id exists to a probing caller.
- Unknown id → 404. Malformed id → 404 as well, so a bad uuid cannot produce a 500.
- Response is the same `TopUpIntentView` the create call returns, so the client parses one shape.
- Registered behind the existing `trusted-identity` guard (authenticated), unlike the callback.

### 7.2 Web `wallet/page.tsx`

- Delete the fake-bank block: the placeholder QR, the account number, the memo, the bank radio
  group, the `bank` state, the `handleCopy` helper and the "bound to SSWAP-3928" copy.
- Replace the QR panel with a real payment panel that states what is true: a **hosted SePay
  checkout** opens in a new tab; the wallet credits when SePay confirms server-to-server.
- After opening checkout, **poll** `GET /wallet/top-ups/:id` on a bounded schedule
  (immediate, then every 3 s up to ~2 min), and stop early on `settled`, `failed`, `reversed`,
  or when the component unmounts. On `settled`, refetch balance + history and show success.
- Keep a manual "check now" affordance, but it polls rather than blindly refetching.
- Polling must not run when there is no pending intent, and must clear its timer on unmount.

### 7.3 Web `classes/[id]/checkout/page.tsx`

- Same poll-after-open behaviour, bounded and cancellable, so the modal reflects settlement.

### 7.4 Mobile

- `wallet-service.ts`: add `getTopUpIntent(id)` parsing `topUpIntentSchema`.
- `wallet-view.tsx`: after opening the checkout URL, poll via the service until terminal.
- `api-evidence.ts`: allowlist `/^\/wallet\/top-ups\/[^/]+$/`. The callback path stays excluded —
  it is server-to-server and must never be recorded as client evidence.

### 7.5 Verification

- Unit: `GetTopUpIntentUseCase` — owner match, owner mismatch → not found, missing → not found.
- Controller/integration: the route is authenticated; a foreign owner gets 404.
- Web: component test asserting the fake bank/QR strings are gone and that a settled poll
  updates the balance from the server.
- Mobile: service test for `getTopUpIntent`; evidence-route allowlist test for the new path.

## 3. Findings while executing (recorded, not assumed)

Three real defects surfaced that the earlier phases had not caught. All are fixed
in this phase, because each one broke the SePay path against a real database:

1. **A migration was registered but never applied.** `pnpm db:migrate` reported
   `wallet-ledger: up to date` while `AddTopUpSettlementColumns1791072000003` was
   still pending, so the live `top_up_intents` table had **no**
   `provider_order_id`, `paid_amount_vnd` or `paid_at` column. Every
   `POST /wallet/top-ups` returned **500** and the IPN credit path could not have
   worked either. `pnpm verify` did not catch this because unit tests use fakes
   and the e2e suite (which needs Docker) is not part of the gate. The e2e spec
   added in §7.5 is what exposed it.
2. **The web deposit panel was hardcoded fake banking UI** — a placeholder QR, a
   real-looking account number `1049281772`, a transfer memo `SSWAP 3928`, and a
   `VCB`/`MB`/`MOMO` radio group whose state was sent to no one. The checkout page
   had a second one: a "VietQR Simulation" modal with a hand-drawn SVG QR and
   `SS NAP 894 MINH`. Both are gone.
3. **The mobile evidence allowlist would have mislabelled the IPN.** The natural
   pattern `/^\/wallet\/top-ups\/[^/]+$/` also matches `.../callback`, so the
   server-to-server IPN would have been recorded as client evidence. The pattern
   now excludes it explicitly, and a test pins that.

Also corrected: two ngrok scripts and `.env.example` still cited `ADR-030` for
FR-008 (it is **ADR-033**); ADR-030 is the account role model.

## 4. Phase 8 reconciliation — as built

- `TopUpReconciliationSweeper`, disabled unless `SEPAY_RECON_ENABLED=true`.
  Verified in a real Nest boot: it logs `enabled: false` and returns without
  touching the network.
- Reuses `HandleTopUpCallbackUseCase`, so exactly-once is not reimplemented; a
  second pass finds the intent already terminal and credits nothing.
- `findStalePending` only selects intents older than `SEPAY_RECON_MIN_AGE_MS`, so
  a checkout the payer is still on is not touched.
- `SepayRestOrderClient` is **not exercised against SePay in any test** and its
  field names are the documented ones, not observed ones (the Sandbox order
  endpoint was not part of the Phase 0 spike). Its parser tolerates the same
  shape drift the IPN showed, so a divergence degrades to "still pending" rather
  than a wrong credit.
- Still missing, and still recorded as a risk in ADR-033: outage backfill, human
  review of a settled/reversed answer, and any alerting beyond a log line.

## 5. Superseded wording

This supersedes the parent plan's §9 Phase 7 wording "replace the placeholder QR +
fake bank toggle with a real Pay now action that submits the SePay checkout form
(design A)" — design A was reversed to B, so the client opens a URL rather than
submitting a form.
