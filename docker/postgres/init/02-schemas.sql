-- ADR-007: schema per module, owned by that module's role.
-- Owner rights cover migrations; PUBLIC is revoked so a module user can only
-- reach its own schema (ADR-007 verification: per-schema permissions only).
CREATE SCHEMA admin_operation AUTHORIZATION skillswap_admin_operation;
CREATE SCHEMA student_verification AUTHORIZATION skillswap_student_verification;
CREATE SCHEMA skill_verification AUTHORIZATION skillswap_skill_verification;
CREATE SCHEMA account_profile AUTHORIZATION skillswap_account_profile;
CREATE SCHEMA live_class AUTHORIZATION skillswap_live_class;
CREATE SCHEMA wallet_ledger AUTHORIZATION skillswap_wallet_ledger;
CREATE SCHEMA schedule AUTHORIZATION skillswap_schedule;

REVOKE ALL ON SCHEMA admin_operation, student_verification, skill_verification,
  account_profile, live_class, wallet_ledger, schedule FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
