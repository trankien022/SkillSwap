import type { Harness } from '../harness';

/**
 * Empties the schemas the E2E flow touches, keeping migrations. Runs before each
 * test so the suite is deterministic regardless of prior runs.
 */
export async function resetDatabase(harness: Harness): Promise<void> {
  await harness.query(
    'account-profile',
    'TRUNCATE accounts, account_credentials, sessions, account_verification_status CASCADE',
  );
  await harness.query(
    'live-class',
    'TRUNCATE classes, class_skills, bookings, room_access_incidents CASCADE',
  );
  await harness.query(
    'wallet-ledger',
    'TRUNCATE wallets, ledger_entries, top_up_intents CASCADE',
  );
  await harness.query(
    'student-verification',
    'TRUNCATE student_verifications, verification_documents CASCADE',
  );
  await harness.query(
    'skill-verification',
    'TRUNCATE skill_evidence, profile_skills, skills, verified_students CASCADE',
  );
}

/** Seeds a skill into the managed catalogue and returns its id (FR-003 / ADR-026). */
export async function seedSkill(
  harness: Harness,
  input: { name: string; category: string } = { name: 'IELTS', category: 'Languages' },
): Promise<string> {
  const rows = await harness.query<{ id: string }>(
    'skill-verification',
    'INSERT INTO skills ("name", "category") VALUES ($1, $2) RETURNING "id"',
    [input.name, input.category],
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error('Failed to seed skill');
  }
  return row.id;
}

/** Reads a wallet balance straight from Postgres. */
export async function walletRow(
  harness: Harness,
  ownerId: string,
): Promise<{ availableCredits: number; pendingCredits: number } | null> {
  const rows = await harness.query<{ available_credits: number; pending_credits: number }>(
    'wallet-ledger',
    'SELECT "available_credits", "pending_credits" FROM wallets WHERE "owner_id" = $1',
    [ownerId],
  );
  const row = rows[0];
  return row === undefined
    ? null
    : { availableCredits: row.available_credits, pendingCredits: row.pending_credits };
}
