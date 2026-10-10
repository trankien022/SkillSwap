import type { Harness } from '../harness';

/**
 * Empties the schemas the E2E flow touches, keeping migrations. Runs before each
 * test so the suite is deterministic regardless of prior runs.
 */
export async function resetDatabase(harness: Harness): Promise<void> {
  await harness.query('account-profile', 'TRUNCATE accounts, account_credentials, sessions CASCADE');
  await harness.query(
    'live-class',
    'TRUNCATE classes, class_skills, bookings, room_access_incidents CASCADE',
  );
  await harness.query(
    'wallet-ledger',
    'TRUNCATE wallets, ledger_entries, top_up_intents CASCADE',
  );
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
