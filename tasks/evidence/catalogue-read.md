# Catalogue and public profile read foundation — 12 October 2026

- Antigravity implemented authenticated GET /api/skills and account-profile bulk public display-name facade; Codex inspected and tested source independently.
- Catalogue uses own-schema active skills, bounded keyset category/name/id tuple, portable canonical base64url JSON cursor with explicit Hermes-compatible padding and strict UTF-8 decoding. Allowed levels come from ADR-026 fixed scale; no fabricated skill_levels table.
- Focused contracts: 18 tests passed; API catalogue controller/query/SQL: 24 tests passed; public profile adapter: 4 tests passed. Typecheck/build and scoped ESLint passed; architecture gate passed (537 modules, 1571 dependencies).
- Actual strict Gateway probe: registered disposable ordinary account, seeded three managed skills with Vietnamese/emoji/delimiter names, fetched three distinct one-item pages, final cursor null, malformed cursor 400, missing credentials 401, four allowed levels present. Removed the three probe skills and logged out; no token/password in evidence.
- Public profile facade returns only id/displayName via one deduplicated parameterized own-schema lookup; no email/private verification data or cross-schema joins.
- Logs: /tmp/skillswap-mobile-catalogue-contract-tests-final.log, /tmp/skillswap-mobile-catalogue-api-tests-final.log, /tmp/skillswap-mobile-profile-facade-tests.log, /tmp/skillswap-mobile-read-foundation-arch.log. Full phase gate pending UI corrections; T12 includes evidence UI and device flow so remains unchecked.
