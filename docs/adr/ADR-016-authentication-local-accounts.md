# ADR-016: Authentication — local accounts, RS256 token issuance, and trusted-identity reconciliation

- **Status:** Accepted
- **Level:** Software (C4 Level 3 · Component)
- **Date:** 2026-10-09

**Context.** `ARCHITECTURE.md` ADR-008 fixes the *verification* half of authentication: the gateway validates a bearer token and forwards the verified identity to the API in trusted `x-user-*` headers, and the API trusts those headers behind a global guard. That half is implemented and tested (`apps/gateway/src/proxy/*`, `apps/api/src/shared/http/trusted-identity.guard.ts`). The *issuance* half is entirely missing: there are no auth endpoints, no accounts table, no password storage, and the dev RSA private key produced by `scripts/generate-dev-keys.mjs` is consumed by nothing. `apps/api/src/modules/account-profile` — the module the C4 model assigns to accounts, profiles and roles — is generated scaffolding only (`module_status` CRUD). FR-001 and UC-006/UC-007 require account creation and sign-in; the SRS marks trusted identity as "Pending implementation" (§C.3).

Rules in play: three independent definitions of the identity header contract already exist (gateway `TRUSTED_HEADERS`, API `trusted-identity.guard.ts`, `packages/contracts` `identityHeadersSchema`); the gateway reads `AUTH_REQUIRED` while the API reads `AUTH_MODE=off|strict` — two uncoordinated switches; and the gateway has no public-route allowlist, so enabling auth would also 401 `/api/health` and Swagger.

No SRS Open Question governs the identity/session model (the OQ table's OQ-001 is skill taxonomy, not identity; OQ-005 is withdrawal limits, not session lifetime). This is therefore an architecture decision to record, not a product OQ to resolve.

**Options considered.**

1. **Local accounts (this ADR).** Accounts and password hashes owned by `account-profile`; the API issues its own RS256 access/refresh tokens; the gateway keeps verifying them. No external identity provider.
2. **Delegated identity (Keycloak/OIDC).** Defer accounts to an IdP. Rejected for MVP: zero references exist repo-wide, no IdP is provisioned, and it adds an operational dependency disproportionate to a single-app MVP.
3. **No issuance (leave verification-only).** Rejected: FR-001 cannot be satisfied and no other feature can run against a real identity.

**Decision.**

1. **Local accounts.** `account-profile` owns `accounts`, `account_credentials` and `sessions` tables in the `account_profile` schema (ADR-007/ADR-014 — own schema, own role, no cross-schema FKs). A local account has `email` (unique, case-insensitive), display name, `role` (`learner|teacher|admin`) and `status` (`active|suspended`).
2. **Passwords** are stored as salted `scrypt` hashes using Node's built-in `node:crypto` (no new runtime dependency); no plaintext ever persisted or logged.
3. **Token issuance** is RS256, signed with the existing `.secrets/jwt-private.pem`, verified by the gateway with `jwt-public.pem`. Access tokens carry `sub`, `email`, `role`, `exp`, `iat`, `jti`; **`exp` is mandatory**. Refresh tokens are opaque random strings stored hashed in `sessions`, rotated on use (single-use) and revoked on logout.
4. **Endpoints** live on the API under `/api/auth/*` (`register`, `login`, `refresh`, `logout`, `me`) and are declared public to the identity guard (they must be reachable before a token exists). `me` uses the trusted identity.
5. **Switch reconciliation.** `AUTH_MODE=strict` (API) and `AUTH_REQUIRED=true` (gateway) are the two halves of "auth on"; when on, the gateway exposes a **public-route allowlist** covering `/api/auth/*`, `/api/health` and `/api/docs*` so enabling auth does not break health checks or docs. Contracts in `packages/contracts` become the single source for the identity header shape.

**Rationale.** Local accounts keep the MVP self-contained and satisfy FR-001 without provisioning an IdP; RS256 with the already-generated key pair reuses ADR-008 unchanged (the gateway is untouched except for the allowlist); `node:crypto` scrypt avoids adding a password-hashing dependency to a repository whose API package currently has none. Refresh rotation bounds the blast radius of a leaked token, and hashing refresh tokens at rest means a database read alone cannot mint sessions.

**Consequences.**

- (+) FR-001 becomes implementable; every other feature gets a real identity.
- (+) No new runtime dependencies; reuses the existing key pair and ADR-008 verification path.
- (+) Auth routes stay reachable with auth on (allowlist) and the two switches are documented as one on/off pair.
- (−) The project now owns credential storage and session lifecycle (rotation, revocation, expiry) — a security surface that a delegated IdP would otherwise carry.
- (−) `account-profile` grows from scaffolding into a real module; its DataSource migration list must include the new tables.
- (−) Deferred, explicitly: password reset, email verification, MFA, social login, and role *enforcement* on business routes (this ADR adds the role claim and guard primitives only).

**Verification.**
- Unit tests: register rejects duplicate/weak input; login rejects wrong password and suspended accounts without leaking existence; refresh rotates and rejects reuse; logout revokes; `me` reflects the trusted identity.
- Gateway test: with `AUTH_REQUIRED=true`, `/api/auth/login` and `/api/health` are public while a protected `/api/classes` request without a token is 401.
- Token test: a token without `exp` is rejected.
- Architecture tests (`pnpm test:arch`) stay green: no `typeorm`/`@nestjs/*` import reaches `domain/` or `application/`.
