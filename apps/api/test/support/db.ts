import type { Harness } from '../harness';
import { waitFor } from './api-client';

/**
 * Waits until the **skill-verification** module's own `verified_students`
 * projection reflects `approved` for `accountId`.
 *
 * The approval event is consumed independently by `account-profile` (into
 * `account_verification_status`, which `/api/auth/me` reads) and by
 * `skill-verification` (into `verified_students`, which the FR-003 submit gate
 * reads). Waiting on `/api/auth/me` therefore only proves the *account-profile*
 * consumer ran, and the submit call can still race into a spurious 403. Poll the
 * projection that actually gates the call instead.
 */
export async function waitVerifiedStudent(harness: Harness, accountId: string): Promise<void> {
  await waitFor(async () => {
    const rows = await harness.query<{ status: string }>(
      'skill-verification',
      'SELECT "status" FROM verified_students WHERE "account_id" = $1',
      [accountId],
    );
    return rows[0]?.status === 'approved' ? rows : null;
  });
}

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
    // `chat_messages` (FR-012) is listed explicitly: it carries no foreign key to `classes`
    // (ADR-014 forbids cross-schema keys, and the denormalised class id is not a constraint),
    // so a CASCADE from `classes` would not reach it and chat rows would pile up across runs --
    // making any `total` assertion depend on how often the suite had run before.
    'TRUNCATE classes, class_skills, bookings, room_access_incidents, teacher_verified, teacher_skill_approval, class_presence, class_reminders, chat_messages, outbox_messages, processed_events CASCADE',
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
  // FR-015 / ADR-034: the audit log is append-only for the application, but a test reset is
  // the one caller allowed to empty it — otherwise an assertion like "exactly one audited
  // replay" would pass or fail depending on how many times the suite had run before.
  await harness.query(
    'admin-operation',
    'TRUNCATE admin_audit_event, outbox_messages, processed_events CASCADE',
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
