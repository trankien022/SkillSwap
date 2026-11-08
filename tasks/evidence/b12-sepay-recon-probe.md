# B12 — live sandbox probe

Date: 2026-11-08T01:02:38.866Z
Host: https://pgapi-sandbox.sepay.vn
Merchant: SP-TEST-LDAB5895
Environment: sandbox
Invoice probed: PROBE-DOES-NOT-EXIST-0001 (deliberately nonexistent — this is a shape probe, not an order)

| Client | URL path | HTTP | content-type | Body |
|---|---|---|---|---|
| old (shipped) | `/v1/orders` | 404 | text/html; charset=UTF-8 | `(empty)` |
| new (fixed) | `/v1/order` | 401 | application/json; charset=UTF-8 | `{"status":401,"error":401,"messages":{"error":"Unauthorized"}}` |

## Auth sweep (new path, every plausible credential form)

| Scheme | HTTP |
|---|---|
| Authorization: Bearer <SEPAY_SECRET_KEY> | 401 |
| Authorization: <SEPAY_SECRET_KEY> (raw) | 401 |
| X-Secret-Key: <SEPAY_SECRET_KEY> | 401 |
| X-Api-Key: <SEPAY_SECRET_KEY> | 401 |
| X-Merchant-Id + X-Secret-Key | 401 |
| Authorization: Bearer <SEPAY_MERCHANT_ID> | 401 |

## What this proves

- `/v1/orders` (the path the adapter shipped with) is **not a route**: the host answers its
  HTML 404 page. `response.ok` is false, so every reconciliation sweep would have thrown.
- `/v1/order` (singular) **is** a route: it answers JSON, not HTML. That is the fix.
- The route still answers `401` for **every** credential form the repo can produce, because
  `SEPAY_SECRET_KEY` is the Payment Gateway HMAC secret that signs the checkout form, not an
  Order API key. So the response *fields* remain unobserved, and the parser stays tolerant.
- Reconciliation therefore still cannot be proven end to end from this repo, and
  `SEPAY_RECON_ENABLED=true` must not be read as "working". What changed is that a future
  operator with a real Order API key will get a clear 401 message naming the cause instead of
  a 404 that looks like a provider outage.
