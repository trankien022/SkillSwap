import { existsSync, readFileSync } from 'node:fs';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Demo seed for the whole current schema.
 *
 *   node scripts/seed-demo.mjs                 # seed (local database only)
 *   node scripts/seed-demo.mjs --allow-remote  # seed the configured remote database
 *   node scripts/seed-demo.mjs --check         # read-only: report target and row counts
 *   node scripts/seed-demo.mjs --reset         # accepted; a plain run already replaces demo rows
 *
 * Requires `pnpm build` first.
 *
 * **Every run replaces the demo rows and only the demo rows.** Demo accounts live on
 * `@demo.skillswap.local`; every demo-owned UUID starts with `5eed`; every demo-owned natural
 * key starts with `demo-seed-`. The deletes below are scoped to those, so a run against a
 * database holding real classes, bookings or credits leaves them untouched. An earlier version
 * of this file cleared 23 tables unconditionally, which made `pnpm db:demo` destructive
 * against whatever `.env` happened to point at.
 *
 * **Target safety.** Both this script and `migrate.mjs` read the repo-root `.env`, so the
 * database that receives the data is not necessarily the one `db:demo` just started. The host
 * is printed, and a non-local host refuses to run without `--allow-remote`.
 *
 * Writes each table through its owning module's data source (ADR-007), so no cross-schema
 * statement is ever issued.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** Shared password for every demo account — printed at the end. */
const DEMO_PASSWORD = 'Demo1234!';
const DEMO_DOMAIN = 'demo.skillswap.local';

/**
 * The Administrator address deliberately is **not** `admin@…`: the deployed demo is public and
 * this password is published, so a guessable admin address is a free login for anyone who
 * reads the repository. Override with `DEMO_ADMIN_EMAIL`.
 */
const DEMO_ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL?.trim() || `quan.tri@${DEMO_DOMAIN}`;

/** Prefix for every demo-owned UUID. `5eed` is valid hex, so the value stays a real UUID. */
const DEMO_ID_PREFIX = '5eed';
/** Prefix for every demo-owned natural key (`reference_id`, `source_event_id`, …). */
const DEMO_REF_PREFIX = 'demo-seed-';

const ARGS = new Set(process.argv.slice(2));
const ALLOW_REMOTE = ARGS.has('--allow-remote');
/** Kept for compatibility: the seed always converges, so `--reset` cannot mean more than that. */
const RESET = ARGS.has('--reset');
const CHECK_ONLY = ARGS.has('--check');

function loadRootEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    if (process.env[match[1]] === undefined && value !== '') {
      process.env[match[1]] = value;
    }
  }
}

async function hashPassword(plaintext) {
  const salt = randomBytes(SALT_BYTES).toString('base64');
  const derived = await scryptAsync(plaintext, salt, KEY_LENGTH);
  return { salt, hash: derived.toString('base64'), keyLength: KEY_LENGTH };
}

loadRootEnv();
const { ApiConfig } = await import(
  pathToFileURL(join(ROOT, 'apps', 'api', 'dist', 'shared', 'config', 'api-config.js')).href
);
const config = new ApiConfig();

/** Loads a module's data source by directory name (e.g. 'account-profile'). */
async function loadDataSource(module) {
  const file = join(
    ROOT, 'apps', 'api', 'dist', 'modules', module, 'internal', 'adapter', 'out', 'persistence', 'data-source.js',
  );
  if (!existsSync(file)) {
    throw new Error(`Missing ${file} — run \`pnpm build\` first.`);
  }
  const mod = await import(pathToFileURL(file).href);
  const ds = mod.createModuleDataSource(config);
  await ds.initialize();
  return ds;
}

// ── Deterministic ids ──────────────────────────────────────────────────────
/**
 * Demo UUIDs are fixed rather than generated, which is what makes a scoped reset possible: the
 * seed deletes `id::text LIKE '5eed%'` and re-inserts the same values, so a re-run converges
 * instead of accumulating rows that nothing references any more.
 *
 * The `kind` is four **hex** characters so the whole string stays a valid UUID, with the
 * version and variant nibbles set (`-4000-8000-`).
 */
const ID_KIND = {
  account: 'acc0',
  skill: '5c11',
  verifier: '0e11',
  profileSkill: 'f5c0',
  evidence: 'e71d',
  evidenceAudit: '0ad7',
  studentVerification: '5e7d',
  document: 'd0c5',
  class: 'c1a5',
  booking: 'b00c',
  rating: '2a71',
  chat: 'c4a7',
  presence: '9e5e',
  reminder: '2e30',
  incident: '1ac1',
  topUp: '70b1',
  session: '5e55',
};

function demoId(kind, index) {
  return `${DEMO_ID_PREFIX}${kind}-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

// ── Demo identities ────────────────────────────────────────────────────────
// 1 admin, 3 verifiers, 10 users. Deterministic emails so re-runs converge.
const ADMIN = { email: DEMO_ADMIN_EMAIL, displayName: 'Quan Tri (Admin)', role: 'admin', index: 1 };
const VERIFIERS = [
  { email: `verifier1@${DEMO_DOMAIN}`, displayName: 'Verifier An', role: 'verifier', expertise: ['IELTS', 'Japanese'], index: 2 },
  { email: `verifier2@${DEMO_DOMAIN}`, displayName: 'Verifier Binh', role: 'verifier', expertise: ['Python', 'React'], index: 3 },
  { email: `verifier3@${DEMO_DOMAIN}`, displayName: 'Verifier Chi', role: 'verifier', expertise: ['Guitar', 'Piano'], index: 4 },
];
const USERS = Array.from({ length: 10 }, (_, i) => ({
  email: `user${i + 1}@${DEMO_DOMAIN}`,
  displayName: `Demo User ${i + 1}`,
  role: 'user',
  index: 5 + i,
}));

/** Managed skill catalogue (ADR-026 §1–2): `category → name`. */
const SKILLS = [
  { category: 'Languages', name: 'IELTS' },
  { category: 'Languages', name: 'Japanese' },
  { category: 'Languages', name: 'English Conversation' },
  { category: 'Programming', name: 'Python' },
  { category: 'Programming', name: 'React' },
  { category: 'Programming', name: 'TypeScript' },
  { category: 'Music', name: 'Guitar' },
  { category: 'Music', name: 'Piano' },
  { category: 'Math', name: 'Calculus' },
  { category: 'Design', name: 'UI/UX' },
];

const ALL_IDENTITIES = [ADMIN, ...VERIFIERS, ...USERS];

/** Account ids are derived from the identity index, so they are known before any query. */
const ACCOUNT_ID = Object.fromEntries(
  ALL_IDENTITIES.map((identity) => [identity.email, demoId(ID_KIND.account, identity.index)]),
);
const DEMO_ACCOUNT_IDS = ALL_IDENTITIES.map((identity) => ACCOUNT_ID[identity.email]);

// ── Target guard ───────────────────────────────────────────────────────────
/** Hosts that are unambiguously the developer's own machine. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal']);

function databaseHost() {
  return process.env.DATABASE_HOST?.trim() || 'localhost';
}

function assertTarget() {
  const host = databaseHost();
  const name = process.env.DATABASE_NAME?.trim() || '(unset)';
  const local = LOCAL_HOSTS.has(host);
  console.log(`\ntarget database: ${host} / ${name}${local ? '' : '  (remote)'}`);
  if (!local && !ALLOW_REMOTE && !CHECK_ONLY) {
    throw new Error(
      `Refusing to write to the non-local host "${host}".\n` +
        'This seed replaces demo rows. Re-run with --allow-remote if that is genuinely the\n' +
        'database you mean, or run --check first to see what is there.',
    );
  }
}

async function upsertAccount(ds, identity) {
  const id = ACCOUNT_ID[identity.email];
  await ds.query(
    `INSERT INTO "account_profile"."accounts" ("id", "email", "display_name", "role", "status")
     VALUES ($1, lower($2), $3, $4, 'active')
     ON CONFLICT ("id") DO UPDATE
       SET "email" = EXCLUDED."email", "display_name" = EXCLUDED."display_name",
           "role" = EXCLUDED."role", "status" = 'active', "suspended_reason" = NULL,
           "suspended_at" = NULL, "updated_at" = now()`,
    [id, identity.email, identity.displayName, identity.role],
  );

  const { salt, hash, keyLength } = await hashPassword(DEMO_PASSWORD);
  await ds.query(
    `INSERT INTO "account_profile"."account_credentials"
       ("account_id", "algorithm", "salt", "hash", "key_length", "updated_at")
     VALUES ($1, 'scrypt', $2, $3, $4, now())
     ON CONFLICT ("account_id") DO UPDATE
       SET "algorithm" = EXCLUDED."algorithm", "salt" = EXCLUDED."salt",
           "hash" = EXCLUDED."hash", "key_length" = EXCLUDED."key_length", "updated_at" = now()`,
    [id, salt, hash, keyLength],
  );
  return id;
}

/**
 * Clears the demo rows. **Every statement is scoped**, and the order follows the schema's
 * foreign keys: `ratings` references both `bookings` and `classes` with NO ACTION, so it must
 * go first or the booking delete fails outright.
 *
 * `skills` is deliberately *not* cleared: the catalogue is shared with real data, and the
 * previous version's unconditional `DELETE FROM skill_verification.skills` would have taken
 * every skill, and every profile reference to one, with it.
 */
async function resetDemo(ctx) {
  // One array bound to $1; every statement below uses the same placeholder.
  const p = [DEMO_ACCOUNT_IDS];
  const uuid = `ANY($1::uuid[])`;
  const text = `ANY($1::text[])`;

  // live_class — children before parents. Tables without an `id` column are matched through
  // their class/booking key instead.
  await ctx.classDs.query(`DELETE FROM "live_class"."ratings" WHERE "id"::text LIKE $1 OR "class_id"::text LIKE $1`, [`${DEMO_ID_PREFIX}%`]);
  await ctx.classDs.query(`DELETE FROM "live_class"."chat_messages" WHERE "id"::text LIKE $1 OR "class_id"::text LIKE $1`, [`${DEMO_ID_PREFIX}%`]);
  await ctx.classDs.query(`DELETE FROM "live_class"."class_presence" WHERE "id"::text LIKE $1 OR "class_id"::text LIKE $1`, [`${DEMO_ID_PREFIX}%`]);
  await ctx.classDs.query(`DELETE FROM "live_class"."room_access_incidents" WHERE "id"::text LIKE $1 OR "class_id"::text LIKE $1`, [`${DEMO_ID_PREFIX}%`]);
  await ctx.classDs.query(`DELETE FROM "live_class"."class_reminders" WHERE "class_id"::text LIKE $1`, [`${DEMO_ID_PREFIX}%`]);
  await ctx.classDs.query(`DELETE FROM "live_class"."class_skills" WHERE "class_id"::text LIKE $1`, [`${DEMO_ID_PREFIX}%`]);
  await ctx.classDs.query(`DELETE FROM "live_class"."bookings" WHERE "class_id"::text LIKE $1 OR "id"::text LIKE $1`, [`${DEMO_ID_PREFIX}%`]);
  await ctx.classDs.query(`DELETE FROM "live_class"."classes" WHERE "id"::text LIKE $1`, [`${DEMO_ID_PREFIX}%`]);
  await ctx.classDs.query(`DELETE FROM "live_class"."teacher_skill_approval" WHERE "account_id" = ${text}`, p);
  await ctx.classDs.query(`DELETE FROM "live_class"."teacher_verified" WHERE "account_id" = ${text}`, p);

  // student_verification
  await ctx.studentDs.query(`DELETE FROM "student_verification"."verification_documents" WHERE "account_id" = ${text}`, p);
  await ctx.studentDs.query(`DELETE FROM "student_verification"."student_verifications" WHERE "account_id" = ${text}`, p);

  // wallet_ledger — ledger rows are identified by their demo reference, not by owner, so the
  // platform-fee row (owner `platform`) is cleared too.
  await ctx.walletDs.query(`DELETE FROM "wallet_ledger"."ledger_entries" WHERE "reference_id" LIKE $1`, [`${DEMO_REF_PREFIX}%`]);
  await ctx.walletDs.query(`DELETE FROM "wallet_ledger"."top_up_intents" WHERE "provider_ref" LIKE $1`, [`${DEMO_REF_PREFIX}%`]);
  // `platform` is included: it is not an account, but the fee rows are keyed to it as owner and
  // a previous version of this script could leave a platform wallet row behind.
  await ctx.walletDs.query(`DELETE FROM "wallet_ledger"."wallets" WHERE "owner_id" = ${text} OR "owner_id" = 'platform'`, p);

  // skill_verification — audit first, then profile_skills (skill_evidence cascades from it).
  await ctx.skillDs.query(
    `DELETE FROM "skill_verification"."skill_evidence_audit"
      WHERE "profile_skill_id" IN (
        SELECT "id" FROM "skill_verification"."profile_skills" WHERE "account_id" = ${text})`,
    p,
  );
  await ctx.skillDs.query(`DELETE FROM "skill_verification"."profile_skills" WHERE "account_id" = ${text}`, p);
  await ctx.skillDs.query(`DELETE FROM "skill_verification"."verifier_expertise" WHERE "account_id" = ${text}`, p);
  await ctx.skillDs.query(`DELETE FROM "skill_verification"."verifiers" WHERE "account_id" = ${text}`, p);
  await ctx.skillDs.query(`DELETE FROM "skill_verification"."verified_students" WHERE "account_id" = ${text}`, p);

  // account_profile — inbox first (push_deliveries cascades), then accounts (credentials and
  // sessions cascade). There is deliberately no orphan sweep: clearing rows whose account is
  // gone was how a previous run reached beyond the demo's own data.
  await ctx.accountDs.query(`DELETE FROM "account_profile"."inbox_notifications" WHERE "account_id" = ${uuid}`, p);
  await ctx.accountDs.query(`DELETE FROM "account_profile"."notification_devices" WHERE "account_id" = ${uuid}`, p);
  await ctx.accountDs.query(`DELETE FROM "account_profile"."account_verification_status" WHERE "account_id" = ${text}`, p);
  await ctx.accountDs.query(`DELETE FROM "account_profile"."sessions" WHERE "account_id" = ${uuid}`, p);
  await ctx.accountDs.query(`DELETE FROM "account_profile"."accounts" WHERE "id" = ${uuid}`, p);

  // admin_operation is deliberately absent: `1791072000001-CreateAdminAuditEvent` revokes UPDATE
  // and DELETE from the module's role, and PostgreSQL honours that even against the table's owner
  // because the ACL is explicit. The store is append-only in fact, not only in intent, so the seed
  // cannot clear its own audit rows. It inserts them idempotently keyed on `source_event_id`
  // instead (see `insertAuditEvent`), which is the same deduplication the production consumer uses.
}

/** Tables reported by `--check` and the closing summary. */
const REPORT_TABLES = [
  ['account-profile', 'accounts'],
  ['account-profile', 'account_verification_status'],
  ['account-profile', 'inbox_notifications'],
  ['admin-operation', 'admin_audit_event'],
  ['live-class', 'classes'],
  ['live-class', 'bookings'],
  ['live-class', 'ratings'],
  ['live-class', 'chat_messages'],
  ['live-class', 'class_presence'],
  ['live-class', 'class_reminders'],
  ['live-class', 'room_access_incidents'],
  ['skill-verification', 'skills'],
  ['skill-verification', 'profile_skills'],
  ['skill-verification', 'skill_evidence'],
  ['skill-verification', 'skill_evidence_audit'],
  ['skill-verification', 'verifiers'],
  ['student-verification', 'student_verifications'],
  ['student-verification', 'verification_documents'],
  ['wallet-ledger', 'wallets'],
  ['wallet-ledger', 'ledger_entries'],
  ['wallet-ledger', 'top_up_intents'],
];

async function reportCounts(ctx) {
  console.log('\nrow counts:');
  for (const [module, table] of REPORT_TABLES) {
    const schema = module.replace('-', '_');
    const rows = await ctx.byModule[module].query(
      `SELECT COUNT(*)::int AS "n" FROM "${schema}"."${table}"`,
    );
    console.log(`  ${`${schema}.${table}`.padEnd(44)} ${rows[0].n}`);
  }
  const demo = await ctx.accountDs.query(
    `SELECT COUNT(*)::int AS "n" FROM "account_profile"."accounts" WHERE "id"::text LIKE $1`,
    [`${DEMO_ID_PREFIX}%`],
  );
  console.log(`\ndemo accounts present: ${demo[0].n} (expected ${ALL_IDENTITIES.length})`);
}

// ── Data helpers ───────────────────────────────────────────────────────────
async function upsertSkill(ds, { name, category }, index) {
  const rows = await ds.query(
    `INSERT INTO "skill_verification"."skills" ("id", "name", "category")
     VALUES ($1, $2, $3)
     ON CONFLICT ("name", "category") DO UPDATE SET "updated_at" = now()
     RETURNING "id"`,
    [demoId(ID_KIND.skill, index), name, category],
  );
  return rows[0].id;
}

/** Creates/refreshes a verifier row and its expertise set. */
async function upsertVerifier(ds, accountId, skillIds) {
  await ds.query(
    `INSERT INTO "skill_verification"."verifiers" ("account_id", "status")
     VALUES ($1, 'active')
     ON CONFLICT ("account_id") DO UPDATE SET "status" = 'active', "updated_at" = now()`,
    [accountId],
  );
  await ds.query(`DELETE FROM "skill_verification"."verifier_expertise" WHERE "account_id" = $1`, [accountId]);
  for (const skillId of skillIds) {
    await ds.query(
      `INSERT INTO "skill_verification"."verifier_expertise" ("account_id", "skill_id")
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [accountId, skillId],
    );
  }
}

/**
 * Upserts one student verification and fans it out into the read projections, mirroring the
 * event flow (ADR-024): account-profile status, skill-verification verified_students,
 * live-class teacher_verified.
 */
async function upsertStudentVerification(ctx, { accountId, schoolName, major, status, reviewerId, reason, index }) {
  const decidedAt = status === 'pending' ? null : new Date();
  const verificationId = demoId(ID_KIND.studentVerification, index);
  await ctx.studentDs.query(
    `INSERT INTO "student_verification"."student_verifications"
       ("id", "account_id", "school_name", "major", "document_ref", "status", "reviewer_id", "reason", "decided_at")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT ("id") DO UPDATE
       SET "account_id" = EXCLUDED."account_id", "school_name" = EXCLUDED."school_name",
           "major" = EXCLUDED."major", "document_ref" = EXCLUDED."document_ref",
           "status" = EXCLUDED."status", "reviewer_id" = EXCLUDED."reviewer_id",
           "reason" = EXCLUDED."reason", "decided_at" = EXCLUDED."decided_at", "updated_at" = now()`,
    [verificationId, accountId, schoolName, major ?? null, `demo-seed/${accountId}.pdf`, status, reviewerId ?? null, reason ?? null, decidedAt],
  );

  const occurredAt = decidedAt ?? new Date();
  await ctx.accountDs.query(
    `INSERT INTO "account_profile"."account_verification_status"
       ("account_id", "status", "reason", "verification_id", "occurred_at", "updated_at")
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT ("account_id") DO UPDATE
       SET "status" = EXCLUDED."status", "reason" = EXCLUDED."reason",
           "verification_id" = EXCLUDED."verification_id", "occurred_at" = EXCLUDED."occurred_at",
           "updated_at" = now()`,
    [accountId, status, reason ?? null, verificationId, occurredAt],
  );
  await ctx.skillDs.query(
    `INSERT INTO "skill_verification"."verified_students" ("account_id", "status", "occurred_at", "updated_at")
     VALUES ($1, $2, $3, now())
     ON CONFLICT ("account_id") DO UPDATE
       SET "status" = EXCLUDED."status", "occurred_at" = EXCLUDED."occurred_at", "updated_at" = now()`,
    [accountId, status, occurredAt],
  );
  await ctx.classDs.query(
    `INSERT INTO "live_class"."teacher_verified" ("account_id", "verified", "school_name", "occurred_at", "updated_at")
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT ("account_id") DO UPDATE
       SET "verified" = EXCLUDED."verified", "school_name" = EXCLUDED."school_name",
           "occurred_at" = EXCLUDED."occurred_at", "updated_at" = now()`,
    [accountId, status === 'approved', status === 'approved' ? schoolName : null, occurredAt],
  );
  return verificationId;
}

/** Upserts a profile skill (owner + skill) and returns its id. */
async function upsertProfileSkill(ds, accountId, skillId, index) {
  const rows = await ds.query(
    `INSERT INTO "skill_verification"."profile_skills" ("id", "account_id", "skill_id")
     VALUES ($1, $2, $3)
     ON CONFLICT ("account_id", "skill_id") DO UPDATE SET "updated_at" = now()
     RETURNING "id"`,
    [demoId(ID_KIND.profileSkill, index), accountId, skillId],
  );
  return rows[0].id;
}

/**
 * Writes an evidence version plus its audit trail (FR-003/FR-018/ADR-028) and, when approved,
 * mirrors the effective level into profile_skills and the live-class teacher_skill_approval
 * projection.
 */
async function upsertEvidence(ctx, { profileSkillId, accountId, skillId, version, status, requestedLevel, approvedLevel, evidenceType, description, claimedBy, reviewerId, evidenceIndex }) {
  const decidedAt = ['approved', 'rejected'].includes(status) ? new Date() : null;
  const claimedAt = claimedBy ? new Date() : null;
  const evidenceId = demoId(ID_KIND.evidence, evidenceIndex);
  await ctx.skillDs.query(
    `INSERT INTO "skill_verification"."skill_evidence"
       ("id", "profile_skill_id", "evidence_type", "document_ref", "description", "version",
        "requested_level", "approved_level", "status", "claimed_by", "claimed_at",
        "reviewer_id", "reason", "decided_at")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT ("id") DO UPDATE
       SET "status" = EXCLUDED."status", "approved_level" = EXCLUDED."approved_level",
           "claimed_by" = EXCLUDED."claimed_by", "claimed_at" = EXCLUDED."claimed_at",
           "reviewer_id" = EXCLUDED."reviewer_id", "reason" = EXCLUDED."reason",
           "decided_at" = EXCLUDED."decided_at"`,
    [
      evidenceId, profileSkillId, evidenceType, null, description, version,
      requestedLevel, approvedLevel ?? null, status, claimedBy ?? null, claimedAt,
      reviewerId ?? null, status === 'rejected' ? 'Insufficient evidence' : null, decidedAt,
    ],
  );

  const snapshot = {
    version,
    status,
    evidenceType,
    requestedLevel,
    approvedLevel: approvedLevel ?? null,
    reason: status === 'rejected' ? 'Insufficient evidence' : null,
  };
  await ctx.skillDs.query(
    `INSERT INTO "skill_verification"."skill_evidence_audit"
       ("evidence_id", "profile_skill_id", "version", "action", "actor_id", "from_status", "to_status", "reason", "snapshot", "occurred_at")
     VALUES ($1, $2, $3, 'submitted', $4, NULL, 'pending', NULL, $5, now())`,
    [evidenceId, profileSkillId, version, accountId, JSON.stringify(snapshot)],
  );
  if (status !== 'pending') {
    const action = status === 'claimed' ? 'claimed' : status;
    await ctx.skillDs.query(
      `INSERT INTO "skill_verification"."skill_evidence_audit"
         ("evidence_id", "profile_skill_id", "version", "action", "actor_id", "from_status", "to_status", "reason", "snapshot", "occurred_at")
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, now())`,
      [evidenceId, profileSkillId, version, action, claimedBy ?? reviewerId ?? accountId, status, snapshot.reason, JSON.stringify(snapshot)],
    );
  }

  if (status === 'approved') {
    await ctx.skillDs.query(
      `UPDATE "skill_verification"."profile_skills" SET "approved_level" = $2, "updated_at" = now()
       WHERE "id" = $1`,
      [profileSkillId, approvedLevel],
    );
    await ctx.classDs.query(
      `INSERT INTO "live_class"."teacher_skill_approval"
         ("account_id", "skill_id", "approved_level", "occurred_at", "updated_at")
       VALUES ($1, $2, $3, now(), now())
       ON CONFLICT ("account_id", "skill_id") DO UPDATE
         SET "approved_level" = EXCLUDED."approved_level", "occurred_at" = EXCLUDED."occurred_at", "updated_at" = now()`,
      [accountId, skillId, approvedLevel],
    );
  }
  return evidenceId;
}

/** Inserts a class and its skill links; returns its id. */
async function insertClass(ctx, { index, teacherId, state, title, level, startsAt, durationMinutes, priceCredits, capacity, description, skillIds, createdAt, completedAt, completionBasis, cancelledAt, cancellationReason }) {
  const classId = demoId(ID_KIND.class, index);
  await ctx.classDs.query(
    `INSERT INTO "live_class"."classes"
       ("id", "teacher_id", "state", "title", "level", "starts_at", "duration_minutes",
        "price_credits", "capacity", "description", "created_at", "completed_at",
        "completion_basis", "cancelled_at", "cancellation_reason")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT ("id") DO UPDATE
       SET "teacher_id" = EXCLUDED."teacher_id", "state" = EXCLUDED."state",
           "title" = EXCLUDED."title", "level" = EXCLUDED."level",
           "starts_at" = EXCLUDED."starts_at", "duration_minutes" = EXCLUDED."duration_minutes",
           "price_credits" = EXCLUDED."price_credits", "capacity" = EXCLUDED."capacity",
           "description" = EXCLUDED."description", "created_at" = EXCLUDED."created_at",
           "completed_at" = EXCLUDED."completed_at",
           "completion_basis" = EXCLUDED."completion_basis",
           "cancelled_at" = EXCLUDED."cancelled_at",
           "cancellation_reason" = EXCLUDED."cancellation_reason", "updated_at" = now()`,
    [
      classId, teacherId, state, title, level, startsAt, durationMinutes, priceCredits,
      capacity, description, createdAt, completedAt ?? null, completionBasis ?? null,
      cancelledAt ?? null, cancellationReason ?? null,
    ],
  );
  for (const skillId of skillIds) {
    await ctx.classDs.query(
      `INSERT INTO "live_class"."class_skills" ("class_id", "skill_id") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [classId, skillId],
    );
  }
  return classId;
}

/** Upserts a booking on a class (deterministic id). */
async function insertBooking(ctx, { index, classId, learnerId, state, priceCredits, idempotencyKey, expiresAt, confirmedAt, cancelledAt, cancelReason, createdAt }) {
  const bookingId = demoId(ID_KIND.booking, index);
  await ctx.classDs.query(
    `INSERT INTO "live_class"."bookings"
       ("id", "class_id", "learner_id", "state", "price_credits", "idempotency_key",
        "expires_at", "confirmed_at", "cancelled_at", "cancel_reason", "created_at")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT ("id") DO UPDATE
       SET "state" = EXCLUDED."state", "confirmed_at" = EXCLUDED."confirmed_at",
           "cancelled_at" = EXCLUDED."cancelled_at", "cancel_reason" = EXCLUDED."cancel_reason",
           "expires_at" = EXCLUDED."expires_at", "created_at" = EXCLUDED."created_at",
           "updated_at" = now()`,
    [
      bookingId, classId, learnerId, state, priceCredits, idempotencyKey,
      expiresAt ?? null, confirmedAt ?? null, cancelledAt ?? null, cancelReason ?? null,
      createdAt,
    ],
  );
  return bookingId;
}

/** Upserts a wallet balance. */
async function upsertWallet(ctx, ownerId, availableCredits, pendingCredits = 0) {
  await ctx.walletDs.query(
    `INSERT INTO "wallet_ledger"."wallets" ("owner_id", "available_credits", "pending_credits", "updated_at")
     VALUES ($1, $2, $3, now())
     ON CONFLICT ("owner_id") DO UPDATE
       SET "available_credits" = EXCLUDED."available_credits",
           "pending_credits" = EXCLUDED."pending_credits", "updated_at" = now()`,
    [ownerId, availableCredits, pendingCredits],
  );
}

/**
 * Posts one ledger movement.
 *
 * `entryType` values are the ones production actually writes (`sql-wallet-repository.ts`):
 * `top_up`, `reversal`, `learner_debit`, `teacher_pending`, `platform_fee`, `release`, `refund`.
 * The unique index on `(entry_type, reference_id)` covers four of them, so the insert is keyed on
 * that pair and a re-run cannot double-post.
 */
async function postMovement(ctx, { ownerId, entryType, direction, amountCredits, referenceId, teacherId, bookingId, releaseKey, occurredAt }) {
  await ctx.walletDs.query(
    `INSERT INTO "wallet_ledger"."ledger_entries"
       ("owner_id", "teacher_id", "amount_credits", "direction", "entry_type", "reference_id",
        "booking_id", "release_key", "trace_id", "created_at")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $6, $9)
     ON CONFLICT DO NOTHING`,
    [ownerId, teacherId ?? ownerId, amountCredits, direction, entryType, referenceId, bookingId ?? null, releaseKey ?? null, occurredAt],
  );
}

/**
 * 90/10 split in integer credits (ADR-002). The teacher's share is floored and the platform takes
 * the remainder, so the two always sum to the price and no float ever appears.
 */
function splitSettlement(priceCredits) {
  const teacherCredits = Math.floor((priceCredits * 9000) / 10000);
  return { teacherCredits, platformFeeCredits: priceCredits - teacherCredits };
}

/**
 * Recomputes every demo wallet from the ledger and upserts it.
 *
 * This is the correction to the previous seed, which asserted balances by hand (`500 + i*250`)
 * while the ledger it was supposed to summarise held nothing of the sort — a learner could hold a
 * confirmed 120-credit booking and an untouched balance. The balance is now a function of the rows,
 * and `assertWalletsReconcile` proves it after the fact rather than trusting the arithmetic here.
 *
 * The two columns follow `sql-wallet-repository.ts` exactly:
 *  - `available` is every credit that has settled, **excluding `teacher_pending`**, minus debits;
 *  - `pending` is teacher income earned but not yet released (`teacher_pending − release`).
 *    A refund reduces the teacher's pending balance in production without a ledger row of its
 *    own (ADR-022), but demo refunds only ever reverse cancelled-class bookings, which never
 *    booked pending income, so nothing is double-counted here.
 *
 * `platform` is skipped: platform fees are not a wallet, and production never creates one.
 */
async function reconcileWallets(ctx) {
  const rows = await ctx.walletDs.query(
    `SELECT "owner_id",
            COALESCE(SUM("amount_credits") FILTER (
              WHERE "direction" = 'credit' AND "entry_type" <> 'teacher_pending'
            ), 0)::int AS "settled_credits",
            COALESCE(SUM("amount_credits") FILTER (WHERE "direction" = 'debit'), 0)::int AS "debits",
            COALESCE(SUM("amount_credits") FILTER (
              WHERE "entry_type" = 'teacher_pending'
            ), 0)::int - COALESCE(SUM("amount_credits") FILTER (
              WHERE "entry_type" = 'release'
            ), 0)::int AS "pending"
       FROM "wallet_ledger"."ledger_entries"
      WHERE "reference_id" LIKE $1
      GROUP BY "owner_id"
     HAVING "owner_id" <> 'platform'`,
    [`${DEMO_REF_PREFIX}%`],
  );
  for (const row of rows) {
    await upsertWallet(ctx, row.owner_id, row.settled_credits - row.debits, row.pending);
  }
  return rows.length;
}

/**
 * Fails the run when a demo wallet does not equal the sum of its own ledger rows.
 */
async function assertWalletsReconcile(ctx) {
  const mismatches = await ctx.walletDs.query(
    `SELECT w."owner_id", w."available_credits", w."pending_credits",
            COALESCE(SUM(l."amount_credits") FILTER (
              WHERE l."direction" = 'credit' AND l."entry_type" <> 'teacher_pending'
            ), 0)::int - COALESCE(SUM(l."amount_credits") FILTER (
              WHERE l."direction" = 'debit'
            ), 0)::int AS "expected_available",
            COALESCE(SUM(l."amount_credits") FILTER (
              WHERE l."entry_type" = 'teacher_pending'
            ), 0)::int - COALESCE(SUM(l."amount_credits") FILTER (
              WHERE l."entry_type" = 'release'
            ), 0)::int AS "expected_pending"
       FROM "wallet_ledger"."wallets" w
       LEFT JOIN "wallet_ledger"."ledger_entries" l
         ON l."owner_id" = w."owner_id" AND l."reference_id" LIKE $1
      WHERE w."owner_id" = ANY($2::text[])
      GROUP BY w."owner_id", w."available_credits", w."pending_credits"
     HAVING w."available_credits" <> COALESCE(SUM(l."amount_credits") FILTER (
              WHERE l."direction" = 'credit' AND l."entry_type" <> 'teacher_pending'
            ), 0)::int - COALESCE(SUM(l."amount_credits") FILTER (
              WHERE l."direction" = 'debit'
            ), 0)::int
         OR w."pending_credits" <> COALESCE(SUM(l."amount_credits") FILTER (
              WHERE l."entry_type" = 'teacher_pending'
            ), 0)::int - COALESCE(SUM(l."amount_credits") FILTER (
              WHERE l."entry_type" = 'release'
            ), 0)::int`,
    [`${DEMO_REF_PREFIX}%`, DEMO_ACCOUNT_IDS],
  );
  if (mismatches.length > 0) {
    const detail = mismatches
      .map((m) => `  ${m.owner_id}: available ${m.available_credits} (ledger ${m.expected_available}), pending ${m.pending_credits} (ledger ${m.expected_pending})`)
      .join('\n');
    throw new Error(`Demo wallets do not reconcile with their ledger:\n${detail}`);
  }
  if (await walletHasNegative(ctx)) {
    throw new Error('A demo wallet was driven negative — the ledger is inconsistent.');
  }
}

async function walletHasNegative(ctx) {
  const rows = await ctx.walletDs.query(
    `SELECT 1 FROM "wallet_ledger"."wallets"
      WHERE "owner_id" = ANY($1::text[]) AND "available_credits" < 0 LIMIT 1`,
    [DEMO_ACCOUNT_IDS],
  );
  return rows.length > 0;
}

/**
 * Writes one audit row, idempotently.
 *
 * The store is append-only — the module's role has `UPDATE, DELETE` revoked (see `resetDemo`) —
 * so a re-run cannot clear demo audit rows the way every other table is cleared. `source_event_id`
 * is unique, exactly as it is for the production consumer, and the insert is keyed on it: the
 * statement is a no-op when the row already exists instead of failing the whole seed.
 */
async function insertAuditEvent(ctx, { action, actorId, targetType, targetId, oldState, newState, occurredAt, key }) {
  await ctx.adminDs.query(
    `INSERT INTO "admin_operation"."admin_audit_event"
       ("action", "actor_id", "target_type", "target_id", "old_state", "new_state",
        "occurred_at", "trace_id", "source_event_id")
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)
     ON CONFLICT ("source_event_id") WHERE "source_event_id" IS NOT NULL DO NOTHING`,
    [
      action,
      actorId,
      targetType,
      targetId ?? null,
      oldState === undefined ? null : JSON.stringify(oldState),
      newState === undefined ? null : JSON.stringify(newState),
      occurredAt,
      `${DEMO_REF_PREFIX}${key}`,
    ],
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
const MODULES = [
  'account-profile',
  'skill-verification',
  'student-verification',
  'live-class',
  'wallet-ledger',
  'admin-operation',
];

const sources = {};
for (const module of MODULES) {
  sources[module] = await loadDataSource(module);
}
const ctx = {
  byModule: sources,
  accountDs: sources['account-profile'],
  skillDs: sources['skill-verification'],
  studentDs: sources['student-verification'],
  classDs: sources['live-class'],
  walletDs: sources['wallet-ledger'],
  adminDs: sources['admin-operation'],
};

try {
  assertTarget();

  if (CHECK_ONLY) {
    await reportCounts(ctx);
    console.log('\n--check is read-only; nothing was written.');
    process.exit(0);
  }

  await resetDemo(ctx);
  console.log(RESET ? 'reset: cleared previous demo rows' : 'cleared any previous demo rows');

  for (const identity of ALL_IDENTITIES) {
    await upsertAccount(ctx.accountDs, identity);
  }
  console.log(`accounts: ${ALL_IDENTITIES.length} (1 admin, ${VERIFIERS.length} verifier, ${USERS.length} user)`);

  const skillIdByName = {};
  for (let i = 0; i < SKILLS.length; i += 1) {
    skillIdByName[SKILLS[i].name] = await upsertSkill(ctx.skillDs, SKILLS[i], i + 1);
  }
  console.log(`skills: ${SKILLS.length}`);

  for (const verifier of VERIFIERS) {
    const skillIds = verifier.expertise.map((name) => {
      const id = skillIdByName[name];
      if (id === undefined) throw new Error(`Verifier ${verifier.email} references unknown skill "${name}"`);
      return id;
    });
    await upsertVerifier(ctx.skillDs, ACCOUNT_ID[verifier.email], skillIds);
  }
  console.log(`verifiers: ${VERIFIERS.length} with expertise`);

  // FR-002: verifications across every status. The first six users are approved students
  // (candidate teachers); one pending and one rejected for the admin queue.
  const adminId = ACCOUNT_ID[ADMIN.email];
  const verifier1Id = ACCOUNT_ID[VERIFIERS[0].email];
  const USER_STATUS = [
    'approved', 'approved', 'approved', 'approved', 'approved', 'approved',
    'pending', 'rejected', 'approved', 'pending',
  ];
  const userIdByIndex = USERS.map((u) => ACCOUNT_ID[u.email]);
  for (let i = 0; i < USERS.length; i += 1) {
    const status = USER_STATUS[i];
    await upsertStudentVerification(ctx, {
      accountId: userIdByIndex[i],
      schoolName: `Demo University ${1 + (i % 3)}`,
      major: ['Computer Science', 'Business', 'Languages'][i % 3],
      status,
      reviewerId: status === 'pending' ? undefined : adminId,
      reason: status === 'rejected' ? 'Document could not be verified' : undefined,
      index: i + 1,
    });
  }
  console.log(`student verifications: ${USERS.length}`);

  // FR-003: approved skills for the teachers (users 1–6). Each teacher gets 1–2 approved skills
  // at a level, so the publish gate is satisfied.
  const TEACHING = [
    { user: 0, skills: ['IELTS', 'English Conversation'] },
    { user: 1, skills: ['Python', 'TypeScript'] },
    { user: 2, skills: ['React', 'TypeScript'] },
    { user: 3, skills: ['Japanese'] },
    { user: 4, skills: ['Guitar', 'Piano'] },
    { user: 5, skills: ['Calculus'] },
  ];
  const LEVELS = ['intermediate', 'advanced', 'expert'];
  let profileSkillSeq = 0;
  let evidenceSeq = 0;
  for (const t of TEACHING) {
    const accountId = userIdByIndex[t.user];
    for (let s = 0; s < t.skills.length; s += 1) {
      const skillName = t.skills[s];
      const skillId = skillIdByName[skillName];
      const level = LEVELS[(t.user + s) % LEVELS.length];
      profileSkillSeq += 1;
      evidenceSeq += 1;
      const profileSkillId = await upsertProfileSkill(ctx.skillDs, accountId, skillId, profileSkillSeq);
      await upsertEvidence(ctx, {
        profileSkillId, accountId, skillId, version: 1, status: 'approved',
        requestedLevel: level, approvedLevel: level,
        evidenceType: 'certificate', description: `Demo certificate for ${skillName}`,
        reviewerId: verifier1Id, evidenceIndex: evidenceSeq,
      });
    }
  }

  // A live verifier queue: two claims for verifier1, covering skills it owns.
  const queueSeeds = [
    { user: 6, skillName: 'IELTS', status: 'pending', claimedBy: null, reviewerId: null },
    { user: 7, skillName: 'Japanese', status: 'claimed', claimedBy: verifier1Id, reviewerId: null },
    { user: 6, skillName: 'English Conversation', status: 'claimed', claimedBy: verifier1Id, reviewerId: null },
  ];
  for (const q of queueSeeds) {
    const accountId = userIdByIndex[q.user];
    const skillId = skillIdByName[q.skillName];
    profileSkillSeq += 1;
    evidenceSeq += 1;
    const profileSkillId = await upsertProfileSkill(ctx.skillDs, accountId, skillId, profileSkillSeq);
    await upsertEvidence(ctx, {
      profileSkillId, accountId, skillId, version: 1, status: q.status,
      requestedLevel: 'intermediate', approvedLevel: null,
      evidenceType: 'verifier_assessment', description: `Demo evidence for ${q.skillName}`,
      claimedBy: q.claimedBy, reviewerId: q.reviewerId, evidenceIndex: evidenceSeq,
    });
  }
  console.log('skill evidence: 6 teachers approved, 3 in the verifier queue');

  // ── FR-005/FR-007: classes + bookings ────────────────────────────────────
  // Teachers are users 0–5. Class states cover the whole lifecycle — all six values the CHECK
  // allows — and each class carries a *backdated* history rather than `now()`, so the demo reads
  // as three weeks of use instead of one timestamp repeated down every table.
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();

  const TEACHER_SKILLS = TEACHING.map((t) => ({
    teacherId: userIdByIndex[t.user],
    skillIds: t.skills.map((name) => skillIdByName[name]),
    teacher: t.user,
  }));

  // B2: each class states the level its teacher is approved at for that skill (the same rule the
  // publish gate applies), so the badge is a fact rather than a catalogue lookup.
  //
  // `startInH` is relative to now: negative is past. Completed classes keep their bookings
  // `confirmed` (see the note in the booking loop).
  const CLASS_SPECS = [
    // ── history: finished, rated, paid ─────────────────────────────────────
    { teacher: 5, skill: 'Calculus', state: 'completed', startInH: -21 * 24, duration: 90, price: 180, capacity: 10, level: 'expert', title: 'Calculus: Limits and Derivatives Explained' },
    { teacher: 1, skill: 'Python', state: 'completed', startInH: -16 * 24, duration: 90, price: 200, capacity: 10, level: 'advanced', title: 'Python for Beginners: Functions and Loops' },
    { teacher: 2, skill: 'React', state: 'completed', startInH: -9 * 24, duration: 120, price: 260, capacity: 12, level: 'expert', title: 'React Hooks Deep Dive' },
    { teacher: 4, skill: 'Guitar', state: 'completed', startInH: -4 * 24, duration: 60, price: 130, capacity: 6, level: 'advanced', title: 'Guitar Chords for Absolute Beginners' },
    // A class its teacher cancelled, refunded end to end (BR-045).
    { teacher: 3, skill: 'Japanese', state: 'cancelled', startInH: -14 * 24, duration: 90, price: 150, capacity: 8, level: 'intermediate', title: 'Japanese Conversation: Ordering Food' },
    // The class running right now: joinable, chat live, presence open.
    { teacher: 0, skill: 'IELTS', state: 'in_progress', startInH: -1, duration: 120, price: 120, capacity: 8, level: 'intermediate', title: 'IELTS Speaking Part 2: cue cards that sound natural' },
    // ── upcoming ───────────────────────────────────────────────────────────
    { teacher: 0, skill: 'English Conversation', state: 'published', startInH: 2, duration: 45, price: 90, capacity: 6, level: 'advanced', title: 'Everyday English Conversation Practice' },
    { teacher: 2, skill: 'TypeScript', state: 'full', startInH: 12, duration: 90, price: 220, capacity: 2, level: 'intermediate', title: 'TypeScript Types That Scale' },
    { teacher: 1, skill: 'TypeScript', state: 'published', startInH: 36, duration: 90, price: 240, capacity: 10, level: 'advanced', title: 'TypeScript Generics: From Confusing to Routine' },
    { teacher: 3, skill: 'Japanese', state: 'published', startInH: 48, duration: 60, price: 160, capacity: 8, level: 'intermediate', title: 'Japanese Particles: は, が and を Without the Guesswork' },
    { teacher: 4, skill: 'Piano', state: 'published', startInH: 72, duration: 60, price: 140, capacity: 6, level: 'intermediate', title: 'Piano: Reading Your First Left-Hand Chords' },
    { teacher: 5, skill: 'Calculus', state: 'published', startInH: 96, duration: 90, price: 190, capacity: 10, level: 'expert', title: 'Calculus: Integration by Parts, Slowly' },
    // Draft: visible only to its teacher (FR-005), so the publish flow has something to publish.
    { teacher: 1, skill: 'Python', state: 'draft', startInH: 120, duration: 90, price: 210, capacity: 10, level: 'advanced', title: 'Python Data Classes and TypedDicts (draft)' },
  ];

  const classIds = [];
  for (let i = 0; i < CLASS_SPECS.length; i += 1) {
    const spec = CLASS_SPECS[i];
    const teacher = TEACHER_SKILLS.find((t) => t.teacher === spec.teacher);
    const startsAtMs = now + spec.startInH * HOUR;
    const classId = await insertClass(ctx, {
      index: i + 1,
      teacherId: teacher.teacherId,
      state: spec.state,
      startsAt: iso(startsAtMs),
      durationMinutes: spec.duration,
      priceCredits: spec.price,
      capacity: spec.capacity,
      title: spec.title,
      level: spec.level,
      description: `Demo ${spec.skill} class #${i + 1} by Demo User ${spec.teacher + 1}`,
      skillIds: [skillIdByName[spec.skill]],
      createdAt: iso(startsAtMs - 6 * DAY),
      completedAt: spec.state === 'completed' ? iso(startsAtMs + spec.duration * 60 * 1000) : null,
      completionBasis: spec.state === 'completed' ? 'scheduled_end' : null,
      cancelledAt: spec.state === 'cancelled' ? iso(startsAtMs - 2 * DAY) : null,
      cancellationReason: spec.state === 'cancelled' ? 'teacher_unavailable' : null,
    });
    classIds.push({ classId, spec, startsAtMs });
  }

  // Learners: users 6–9 (the non-teachers). Every completed class has a full house of confirmed
  // bookings because those bookings are what the ledger and the ratings below are built from.
  const learnerIds = userIdByIndex.slice(6);
  const bookings = [];
  let bookingSeq = 0;
  for (let ci = 0; ci < classIds.length; ci += 1) {
    const { classId, spec, startsAtMs } = classIds[ci];
    const isPast = spec.state === 'completed' || spec.state === 'cancelled';
    const seats = spec.state === 'full' ? 2 : isPast ? 3 : Math.min(spec.capacity, 2 + (ci % 3));
    for (let s = 0; s < seats; s += 1) {
      const learnerId = learnerIds[(ci + s) % learnerIds.length];
      // A booking stays `confirmed` when its class completes — nothing transitions a booking to
      // `completed`, and both the rating gate and `ratingEligible` read `confirmed` + a completed
      // class. Seeding `completed` made the class impossible to rate in the demo.
      const state =
        spec.state === 'completed'
          ? 'confirmed'
          : spec.state === 'cancelled'
            ? 'cancelled'
            : spec.state === 'in_progress'
              ? 'confirmed'
              : s % 3 === 0
                ? 'pending'
                : 'confirmed';
      const confirmedAtMs = state === 'confirmed' ? startsAtMs - 3 * DAY : null;
      bookingSeq += 1;
      const bookingId = await insertBooking(ctx, {
        index: bookingSeq,
        classId,
        learnerId,
        state,
        priceCredits: spec.price,
        idempotencyKey: `${DEMO_REF_PREFIX}cls${ci}-seat${s}`,
        expiresAt: state === 'pending' ? iso(Math.min(now + 30 * 60 * 1000, startsAtMs)) : null,
        confirmedAt: confirmedAtMs === null ? null : iso(confirmedAtMs),
        cancelledAt: state === 'cancelled' ? iso(startsAtMs - 2 * DAY) : null,
        cancelReason: state === 'cancelled' ? 'class_cancelled' : null,
        createdAt: iso(startsAtMs - 4 * DAY),
      });
      bookings.push({ bookingId, classId, learnerId, state, spec, startsAtMs });
    }
  }
  console.log(`classes: ${classIds.length} (6 states), bookings: ${bookings.length}`);

  // ── FR-008/FR-009/FR-010: the ledger, then the balances ──────────────────
  // Ledger first. Every confirmed booking debits the learner and splits the price 90/10 to the
  // teacher (pending) and the platform; every completed class releases the teacher's pending
  // income; a cancelled class refunds the learner. Balances are derived from these rows at the
  // end, so the wallet history and the wallet total cannot disagree.
  const learnerTopUp = new Map();
  for (let i = 0; i < USERS.length; i += 1) {
    const ownerId = userIdByIndex[i];
    const credits = 500 + i * 250;
    learnerTopUp.set(ownerId, credits);
    await postMovement(ctx, {
      ownerId,
      entryType: 'top_up',
      direction: 'credit',
      amountCredits: credits,
      referenceId: `${DEMO_REF_PREFIX}topup-user${i + 1}`,
      occurredAt: iso(now - (24 - i) * DAY),
    });
  }

  // Four top-up intents covering every status the CHECK allows (FR-008), so `/wallet` can show a
  // settled credit, a pending payment, a failed one and a reversed one.
  const TOP_UPS = [
    { index: 1, ownerId: learnerIds[0], ref: 'topup-a', credits: 500, vnd: 500_000, status: 'settled', atMs: now - 18 * DAY },
    { index: 2, ownerId: learnerIds[1], ref: 'topup-b', credits: 300, vnd: 300_000, status: 'settled', atMs: now - 11 * DAY },
    { index: 3, ownerId: learnerIds[2], ref: 'topup-c', credits: 400, vnd: 400_000, status: 'pending', atMs: now - 2 * HOUR },
    { index: 4, ownerId: learnerIds[3], ref: 'topup-d', credits: 200, vnd: 200_000, status: 'failed', atMs: now - 6 * DAY },
    { index: 5, ownerId: learnerIds[0], ref: 'topup-e', credits: 250, vnd: 250_000, status: 'reversed', atMs: now - 5 * DAY },
  ];
  for (const topUp of TOP_UPS) {
    const settled = topUp.status === 'settled';
    const decidedMs = topUp.status === 'pending' ? null : topUp.atMs + 5 * 60 * 1000;
    await ctx.walletDs.query(
      `INSERT INTO "wallet_ledger"."top_up_intents"
         ("id", "owner_id", "provider", "provider_ref", "provider_order_id", "amount_vnd",
          "amount_credits", "paid_amount_vnd", "paid_at", "status", "created_at", "updated_at")
       VALUES ($1, $2, 'sepay', $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT ("id") DO UPDATE
         SET "status" = EXCLUDED."status", "paid_amount_vnd" = EXCLUDED."paid_amount_vnd",
             "paid_at" = EXCLUDED."paid_at", "updated_at" = EXCLUDED."updated_at"`,
      [
        demoId(ID_KIND.topUp, topUp.index),
        topUp.ownerId,
        `${DEMO_REF_PREFIX}${topUp.ref}`,
        `ORD-${topUp.ref.toUpperCase()}`,
        topUp.vnd,
        topUp.credits,
        settled ? topUp.vnd : null,
        decidedMs === null ? null : iso(decidedMs),
        topUp.status,
        iso(topUp.atMs),
        iso(decidedMs ?? topUp.atMs),
      ],
    );
  }
  // The reversed intent has a matching debit, so the "money taken back" path has a real row.
  await postMovement(ctx, {
    ownerId: learnerIds[0],
    entryType: 'reversal',
    direction: 'debit',
    amountCredits: 250,
    referenceId: `${DEMO_REF_PREFIX}topup-e`,
    occurredAt: iso(now - 5 * DAY + 60 * 60 * 1000),
  });

  for (const booking of bookings) {
    // A cancelled-class booking was paid and then refunded, so it gets the learner's debit but no
    // teacher income: the lesson never happened. Posting `teacher_pending` for it would leave the
    // teacher holding income for a class that was called off, and posting the refund without the
    // debit would mint credits out of nothing.
    if (booking.state !== 'confirmed' && booking.state !== 'cancelled') continue;
    const { bookingId, learnerId, spec, startsAtMs } = booking;
    const isRefunded = booking.state === 'cancelled';
    const { teacherCredits, platformFeeCredits } = splitSettlement(spec.price);
    const teacherId = TEACHER_SKILLS.find((t) => t.teacher === spec.teacher).teacherId;
    const paidAt = iso(startsAtMs - 3 * DAY);

    await postMovement(ctx, {
      ownerId: learnerId, entryType: 'learner_debit', direction: 'debit',
      amountCredits: spec.price, referenceId: `${DEMO_REF_PREFIX}booking-${bookingId}`,
      bookingId, occurredAt: paidAt,
    });
    if (isRefunded) continue;

    await postMovement(ctx, {
      ownerId: teacherId, entryType: 'teacher_pending', direction: 'credit',
      amountCredits: teacherCredits, referenceId: `${DEMO_REF_PREFIX}booking-${bookingId}`,
      teacherId, bookingId, occurredAt: paidAt,
    });
    await postMovement(ctx, {
      ownerId: 'platform', entryType: 'platform_fee', direction: 'credit',
      amountCredits: platformFeeCredits, referenceId: `${DEMO_REF_PREFIX}booking-${bookingId}`,
      teacherId, bookingId, occurredAt: paidAt,
    });

    // FR-020: income is released only once the class completed. Three of the four finished
    // classes are settled; the most recent keeps its pending income so the teacher's wallet shows
    // both a released history and earnings still on hold.
    if (spec.state === 'completed' && spec.startInH < -5 * 24) {
      await postMovement(ctx, {
        ownerId: teacherId, entryType: 'release', direction: 'credit',
        amountCredits: teacherCredits, referenceId: `${DEMO_REF_PREFIX}booking-${bookingId}`,
        teacherId, bookingId, releaseKey: `${DEMO_REF_PREFIX}release-${bookingId}`,
        occurredAt: iso(startsAtMs + spec.duration * 60 * 1000),
      });
    }
  }

  // The cancelled class refunds each learner in full (BR-045 / ADR-022).
  for (const booking of bookings) {
    if (booking.state !== 'cancelled') continue;
    await postMovement(ctx, {
      ownerId: booking.learnerId,
      entryType: 'refund',
      direction: 'credit',
      amountCredits: booking.spec.price,
      referenceId: `${DEMO_REF_PREFIX}booking-${booking.bookingId}`,
      bookingId: booking.bookingId,
      occurredAt: iso(booking.startsAtMs - 2 * DAY),
    });
  }

  // Balances are now a pure function of the rows above.
  const walletCount = await reconcileWallets(ctx);
  await assertWalletsReconcile(ctx);
  console.log(`wallets: ${walletCount} derived from the ledger and reconciled`);

  await reportCounts(ctx);

  console.log('\nDemo credentials (password for every account: ' + DEMO_PASSWORD + ')');
  console.log(`  admin     ${ADMIN.email}`);
  for (const v of VERIFIERS) console.log(`  verifier  ${v.email}`);
  console.log(`  user      ${USERS[0].email} … ${USERS[USERS.length - 1].email}`);
} finally {
  for (const module of MODULES) {
    if (sources[module].isInitialized) await sources[module].destroy();
  }
}
