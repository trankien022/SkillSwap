# Runbook — local SePay top-up demo (FR-008 / ADR-033)

How to prove a real wallet top-up on a developer machine, end to end, with no mock in the
path. Read [ADR-033](../adr/ADR-033-wallet-topup-sepay-payment-gateway.md) first; this file
is the operational procedure, not the reasoning.

**What this proves.** `POST /wallet/top-ups` returns a hosted SePay checkout URL, paying on
that page makes SePay call our IPN, and the wallet is credited exactly once.

---

## 1. One-time setup, per teammate

1. Install **ngrok Agent v3** — <https://ngrok.com/download>. Check with `ngrok version`.
2. Get your own auth token — <https://dashboard.ngrok.com/get-started/your-authtoken>.
3. `cp .env.example .env`, then fill in:
   - `NGROK_AUTHTOKEN` — your token.
   - `SEPAY_MERCHANT_ID`, `SEPAY_SECRET_KEY` — sandbox credentials (see §3).
   - `SEPAY_RETURN_URL` — `https://<dev-domain>`.
   - `SEPAY_RETURN_URL_ALLOWED_ORIGINS` — extra browser origins the payer may be sent back to
     (comma separated), e.g. `http://localhost:3000` so the local web client's
     `/payment/result` page is accepted. The configured return URL's origin is allowed anyway.

Never commit `.env`. It is git-ignored; keep it that way.

## 2. One-time setup, per team

The **reserved domain** is shared: it is what SePay is configured to call, so it must not
rotate per developer.

1. Reserve one free static domain at <https://dashboard.ngrok.com/domains>.
2. Put it in two places and keep them identical:
   - `ngrok.yml` → the `api` endpoint `url`.
   - `.env` → `NGROK_DOMAIN` and `SEPAY_RETURN_URL`.

   Both are non-secret; the domain is committed on purpose so everyone's tunnel matches.

## 3. One-time setup, in SePay

1. Register at <https://my.sepay.vn> → **Payment Gateway** → **Sandbox**. Sandbox is fully
   isolated and needs no bank account.
2. Copy the sandbox **merchant id** and **secret key** into `.env`.
3. **Payment Gateway → Configuration → IPN** → set:

   ```
   https://<dev-domain>/api/wallet/top-ups/callback
   ```

   The path is `/api/wallet/top-ups/callback` because the gateway strips no prefix: the API
   serves the route under `/api`.

The IPN URL must be public HTTPS. SePay rejects `localhost` and internal IPs, which is the
entire reason ngrok is in this loop.

## 4. Every run

```bash
pnpm db:up          # postgres + rabbitmq
pnpm dev            # gateway :4000, api :4001, web :3000, and the ngrok tunnel
```

`pnpm dev` starts the tunnel alongside the apps. Confirm it is up at
<http://127.0.0.1:4040> — the tunnel must show the reserved domain forwarding to
`http://localhost:4001`.

On Windows you can also start or restart just the tunnel:

```powershell
.\scripts\start-ngrok.ps1
```

## 5. The demo

1. Sign in, open **Wallet**, choose an amount (a whole number of credits).
2. The app returns a hosted SePay checkout URL and opens it.
3. Pay with Sandbox's test method on SePay's page.
4. SePay POSTs the IPN; the wallet credits and the balance/history refresh.

**Expected IPN.** `notification_type` is `ORDER_PAID` (or `PAYMENT_SUCCESS`), and our
response is exactly HTTP 200 `{"success": true}`. SePay also fires a browser `GET` on the
same path from the `success_url`; that call credits nothing. This is expected.

## 6. Troubleshooting

| Symptom | Likely cause | Check |
|---|---|---|
| No checkout URL; an error from `POST /wallet/top-ups` | SePay rejected the signed form | Field order and `SEPAY_SECRET_KEY`. The signing order is pinned by a unit test — if that test passes, the secret is wrong. |
| Checkout page says invalid signature | Wrong checkout host for the environment | `SEPAY_CHECKOUT_HOST`: sandbox vs production. |
| No IPN arrives at all | Tunnel down, or SePay's IPN URL not saved | `http://127.0.0.1:4040` shows requests; re-check §3.3. |
| IPN arrives but credits nothing | Unknown invoice, a replay, or an amount mismatch | API logs state which. Amount mismatch is **by design** — the intent stays `pending`. |
| Tunnel exits with `ERR_NGROK_334` | Someone else is already on the reserved domain | ngrok free plan has no endpoint pooling. Take turns, or reserve a domain per developer. |
| Tunnel fails with `ERR_NGROK_105` | Token not supplied at start time | `agent.authtoken: ${VAR}` does **not** work — ngrok passes the literal string. The launcher passes `--authtoken`; the PowerShell script exports it. |
| `JWT private key not readable` | API started from the wrong cwd | Start the API from `apps/api`. |

## 7. Sandbox vs Production

| | Sandbox | Production |
|---|---|---|
| Checkout host | `https://pay-sandbox.sepay.vn` | `https://pay.sepay.vn` |
| REST base | `https://pgapi-sandbox.sepay.vn` | `https://pgapi.sepay.vn` |
| Credentials | instant, no bank account | merchant account approval required |
| Code | identical — configuration only | identical |

Moving to production is a `.env` change plus setting the production IPN URL in the SePay
dashboard. There is no code branch on environment.

## 8. Known gaps — do not treat this as production-ready

- **The app must sit behind an IP allow-list.** The IPN carries no signature and no secret
  header, so authenticity is the SePay source allow-list plus the invoice lookup
  (ADR-033 §6). An unauthenticated, un-proxied deployment would accept forged IPNs.
- **Reconciliation is a disabled stub** (`SEPAY_RECON_ENABLED=false`). A payment that
  succeeds while the process is down will not self-heal; reconcile manually from the SePay
  dashboard until the full version exists.
- **Nothing in CI calls SePay.** Suite coverage comes from posting IPN bodies locally.
  Sandbox reachability was verified by hand (Phase 0) and is not continuously checked.
