-- ADR-007: one login per module schema. Dev password mirrors DATABASE_PASSWORD
-- (.env.example default: skillswap_dev). Runs once on first container boot.
CREATE ROLE skillswap_admin_operation LOGIN PASSWORD 'skillswap_dev';
CREATE ROLE skillswap_student_verification LOGIN PASSWORD 'skillswap_dev';
CREATE ROLE skillswap_skill_verification LOGIN PASSWORD 'skillswap_dev';
CREATE ROLE skillswap_account_profile LOGIN PASSWORD 'skillswap_dev';
CREATE ROLE skillswap_live_class LOGIN PASSWORD 'skillswap_dev';
CREATE ROLE skillswap_wallet_ledger LOGIN PASSWORD 'skillswap_dev';
CREATE ROLE skillswap_schedule LOGIN PASSWORD 'skillswap_dev';
