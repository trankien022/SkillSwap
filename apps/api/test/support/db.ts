import type { Harness } from '../harness';

/**
 * Empties the schemas the E2E flow touches, keeping migrations. Runs before each
 * test so the suite is deterministic regardless of prior runs.
 */
export async function resetDatabase(harness: Harness): Promise<void> {
  await harness.query(
    'account-profile',
    'TRUNCATE accounts, account_credentials, sessions, account_verification_status, outbox_messages, processed_events CASCADE',
  );
  await harness.query(
    'live-class',
    'TRUNCATE classes, class_skills, bookings, room_access_incidents, teacher_verified, teacher_skill_approval, outbox_messages, processed_events CASCADE',
  );
  await harness.query(
    'wallet-ledger',
    'TRUNCATE wallets, ledger_entries, top_up_intents, outbox_messages, processed_events CASCADE',
  );
  await harness.query(
    'student-verification',
    'TRUNCATE student_verifications, verification_documents, outbox_messages, processed_events CASCADE',
  );
  await harness.query(
    'skill-verification',
    'TRUNCATE skill_evidence, skill_evidence_audit, profile_skills, skills, verified_students, verifier_expertise, verifiers, outbox_messages, processed_events CASCADE',
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

/** Seeds a Verifier account with expertise (FR-004 / ADR-027; operator-provisioned). */
export async function seedVerifier(
  harness: Harness,
  input: { accountId: string; expertise: string[]; status?: 'active' | 'suspended' | 'revoked' },
): Promise<void> {
  await harness.query(
    'skill-verification',
    `INSERT INTO verifiers ("account_id", "status") VALUES ($1, $2)
       ON CONFLICT ("account_id") DO UPDATE SET "status" = EXCLUDED."status"`,
    [input.accountId, input.status ?? 'active'],
  );
  for (const skillId of input.expertise) {
    await harness.query(
      'skill-verification',
      `INSERT INTO verifier_expertise ("account_id", "skill_id") VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
      [input.accountId, skillId],
    );
  }
}

/**
 * FR-001/FR-004 / ADR-029: provisions a real verifier account (role `verifier`) in
 * `account-profile` plus its expertise, and returns the account id.
 */
export async function seedVerifierAccount(
  harness: Harness,
  input: { email: string; expertise: string[]; displayName?: string },
): Promise<string> {
  const rows = await harness.query<{ id: string }>(
    'account-profile',
    `INSERT INTO accounts ("email", "display_name", "role", "status")
     VALUES (lower($1), $2, 'verifier', 'active')
     RETURNING "id"`,
    [input.email, input.displayName ?? 'Provisioned Verifier'],
  );
  const accountId = rows[0]?.id;
  if (accountId === undefined) {
    throw new Error('Failed to seed verifier account');
  }
  await seedVerifier(harness, { accountId, expertise: input.expertise });
  return accountId;
}

/**
 * FR-005 / ADR-024: seed the `live-class` publish-rights projection directly so a test
 * can publish a class without driving the whole verification/evidence event flow.
 * `verified` marks the teacher a verified student; `approvedLevels` grants per-skill levels.
 */
export async function seedTeacherTrust(
  harness: Harness,
  input: {
    teacherId: string;
    verified?: boolean;
    approvedLevels?: Record<string, 'beginner' | 'intermediate' | 'advanced' | 'expert'>;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await harness.query(
    'live-class',
    `INSERT INTO teacher_verified ("account_id", "verified", "occurred_at")
       VALUES ($1, $2, $3)
       ON CONFLICT ("account_id") DO UPDATE SET "verified" = EXCLUDED."verified", "occurred_at" = EXCLUDED."occurred_at"`,
    [input.teacherId, input.verified ?? true, now],
  );
  for (const [skillId, level] of Object.entries(input.approvedLevels ?? {})) {
    await harness.query(
      'live-class',
      `INSERT INTO teacher_skill_approval ("account_id", "skill_id", "approved_level", "occurred_at")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("account_id", "skill_id") DO UPDATE
           SET "approved_level" = EXCLUDED."approved_level", "occurred_at" = EXCLUDED."occurred_at"`,
      [input.teacherId, skillId, level, now],
    );
  }
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
