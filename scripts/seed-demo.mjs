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
 *   node scripts/seed-demo.mjs --upload-documents  # also upload the demo PDFs to Cloudinary
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
/**
 * FR-002 document-open limitation. `read-verification-document` signs a Cloudinary URL from
 * `document_ref`, so a fake key produces a URL that 404s. With this flag and real
 * `CLOUDINARY_*` credentials the seed uploads a real one-page PDF under each key, which makes
 * the admin's "open document" action demoable. Without credentials it prints a warning instead
 * of failing — the rest of the dataset does not depend on it.
 */
const UPLOAD_DOCUMENTS = ARGS.has('--upload-documents');

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
  studentDocument: 'd0c5',
  class: 'c1a5',
  booking: 'b00c',
  rating: '2a71',
  chat: 'c4a7',
  presence: '9e5e',
  reminder: '2e30',
  incident: '1ac1',
  topUp: '70b1',
  session: '5e55',
  notification: '0071',
  device: 'de71',
};

function demoId(kind, index) {
  return `${DEMO_ID_PREFIX}${kind}-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

// ── Demo identities ────────────────────────────────────────────────────────
// 1 admin, 5 verifiers, 10 users. Deterministic emails so re-runs converge.
const ADMIN = { email: DEMO_ADMIN_EMAIL, displayName: 'Quan Tri (Admin)', role: 'admin', index: 1 };
const VERIFIERS = [
  { email: `verifier1@${DEMO_DOMAIN}`, displayName: 'Verifier An', role: 'verifier', expertise: ['IELTS', 'English Conversation', 'Japanese'], status: 'active', index: 2 },
  { email: `verifier2@${DEMO_DOMAIN}`, displayName: 'Verifier Binh', role: 'verifier', expertise: ['Python', 'React', 'TypeScript', 'Calculus'], status: 'active', index: 3 },
  { email: `verifier3@${DEMO_DOMAIN}`, displayName: 'Verifier Chi', role: 'verifier', expertise: ['Guitar', 'Piano'], status: 'active', index: 4 },
  // Suspended and revoked Verifiers have decided nothing, so standing them down does not rewrite
  // anybody's approval history — the admin screens show the states without a fake past.
  { email: `verifier4@${DEMO_DOMAIN}`, displayName: 'Verifier Dung', role: 'verifier', expertise: ['UI/UX'], status: 'suspended', index: 5 },
  { email: `verifier5@${DEMO_DOMAIN}`, displayName: 'Verifier Em', role: 'verifier', expertise: [], status: 'revoked', index: 6 },
];
const USERS = Array.from({ length: 10 }, (_, i) => ({
  email: `user${i + 1}@${DEMO_DOMAIN}`,
  displayName: `Demo User ${i + 1}`,
  role: 'user',
  index: 7 + i,
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
  //
  // Two reference shapes exist and both must be cleared. The seed's own rows use natural keys
  // (`demo-seed-topup-user1`), but production writes `intent.id` for a top-up and `booking.id` for
  // a booking, so anything the API posts against a demo intent or booking is keyed by a `5eed…`
  // id. A forged IPN during a demo probe produced exactly such a row and survived the older
  // `demo-seed-%`-only delete, leaving credits the dataset never accounted for.
  await ctx.walletDs.query(
    `DELETE FROM "wallet_ledger"."ledger_entries" WHERE "reference_id" LIKE $1 OR "reference_id" LIKE $2`,
    [`${DEMO_REF_PREFIX}%`, `${DEMO_ID_PREFIX}%`],
  );
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
  // cannot clear its own audit rows. Audit rows are written in the ops phase below, keyed on
  // `source_event_id`, which is the same deduplication the production consumer uses.
}

/**
 * Tables reported by `--check` and the closing summary, with the predicate that identifies a row
 * this seed owns.
 *
 * The database is shared with end-to-end residue (accounts on `@skillswap.test`, their classes and
 * ledger rows), so a bare `COUNT(*)` answers "what is in the table", not "what did the seed write".
 * Reporting both is what makes a re-run verifiable: the demo column must not change between runs.
 */
const REPORT_TABLES = [
  ['account-profile', 'accounts', `"id"::text LIKE '${DEMO_ID_PREFIX}%'`],
  ['account-profile', 'account_verification_status', `"account_id" LIKE '${DEMO_ID_PREFIX}%'`],
  ['account-profile', 'inbox_notifications', `"deduplication_key" LIKE '${DEMO_REF_PREFIX}%'`],
  ['account-profile', 'notification_devices', `"installation_id" LIKE '${DEMO_REF_PREFIX}%'`],
  ['account-profile', 'push_deliveries', `"notification_id" IN (
      SELECT "id" FROM "account_profile"."inbox_notifications"
       WHERE "deduplication_key" LIKE '${DEMO_REF_PREFIX}%')`],
  ['admin-operation', 'admin_audit_event', `"source_event_id" LIKE '${DEMO_REF_PREFIX}%'`],
  ['live-class', 'classes', `"id"::text LIKE '${DEMO_ID_PREFIX}%'`],
  ['live-class', 'bookings', `"id"::text LIKE '${DEMO_ID_PREFIX}%'`],
  ['live-class', 'ratings', `"id"::text LIKE '${DEMO_ID_PREFIX}%'`],
  ['live-class', 'chat_messages', `"id"::text LIKE '${DEMO_ID_PREFIX}%'`],
  ['live-class', 'class_presence', `"id"::text LIKE '${DEMO_ID_PREFIX}%'`],
  ['live-class', 'class_reminders', `"class_id"::text LIKE '${DEMO_ID_PREFIX}%'`],
  ['live-class', 'room_access_incidents', `"id"::text LIKE '${DEMO_ID_PREFIX}%'`],
  ['skill-verification', 'skills', null],
  ['skill-verification', 'profile_skills', `"account_id" LIKE '${DEMO_ID_PREFIX}%'`],
  ['skill-verification', 'skill_evidence', `"id"::text LIKE '${DEMO_ID_PREFIX}%'`],
  ['skill-verification', 'skill_evidence_audit', `"id"::text LIKE '${DEMO_ID_PREFIX}%'`],
  ['skill-verification', 'verifiers', `"account_id" LIKE '${DEMO_ID_PREFIX}%'`],
  ['student-verification', 'student_verifications', `"account_id" LIKE '${DEMO_ID_PREFIX}%'`],
  ['student-verification', 'verification_documents', `"account_id" LIKE '${DEMO_ID_PREFIX}%'`],
  ['wallet-ledger', 'wallets', `"owner_id" LIKE '${DEMO_ID_PREFIX}%' OR "owner_id" LIKE '${DEMO_REF_PREFIX}%'`],
  ['wallet-ledger', 'ledger_entries', `"reference_id" LIKE '${DEMO_REF_PREFIX}%' OR "reference_id" LIKE '${DEMO_ID_PREFIX}%'`],
  ['wallet-ledger', 'top_up_intents', `"provider_ref" LIKE '${DEMO_REF_PREFIX}%'`],
];

async function reportCounts(ctx) {
  console.log('\nrow counts (demo-owned / total):');
  for (const [module, table, scope] of REPORT_TABLES) {
    const schema = module.replace('-', '_');
    const rows = await ctx.byModule[module].query(
      `SELECT COUNT(*)::int AS "total",
              ${scope === null ? 'NULL::int' : `COUNT(*) FILTER (WHERE ${scope})::int`} AS "demo"
         FROM "${schema}"."${table}"`,
    );
    const demo = rows[0].demo === null ? '(shared)' : String(rows[0].demo);
    console.log(
      `  ${`${schema}.${table}`.padEnd(44)} ${demo.padStart(4)} / ${rows[0].total}`,
    );
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
async function upsertVerifier(ds, accountId, skillIds, status = 'active') {
  await ds.query(
    `INSERT INTO "skill_verification"."verifiers" ("account_id", "status")
     VALUES ($1, $2)
     ON CONFLICT ("account_id") DO UPDATE SET "status" = EXCLUDED."status", "updated_at" = now()`,
    [accountId, status],
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

/** Marks an account suspended (ADR-037). The CHECK demands a reason and a timestamp together. */
async function suspendAccount(ds, accountId, reason, at) {
  await ds.query(
    `UPDATE "account_profile"."accounts"
        SET "status" = 'suspended', "suspended_reason" = $2, "suspended_at" = $3, "updated_at" = now()
      WHERE "id" = $1`,
    [accountId, reason, at],
  );
}

/**
 * Upserts one student verification and fans it out into the read projections, mirroring the
 * event flow (ADR-024): account-profile status, skill-verification verified_students,
 * live-class teacher_verified.
 */
async function upsertStudentVerification(ctx, {
  accountId, schoolName, major, status, reviewerId, reason, index,
  submittedAt, decidedAt, revokedAt, revocationReason, document,
}) {
  // A revoked row is an approval that was later withdrawn, so it keeps the date it was decided
  // (`sql-verification-repository.revoke` only sets status/revoker/reason/revoked_at and leaves
  // `decided_at` alone). Dropping it here lost the fact that the student had ever been approved.
  const decided = ['approved', 'rejected', 'revoked'].includes(status)
    ? (decidedAt ?? new Date())
    : null;
  const revoked = status === 'revoked' ? (revokedAt ?? decided ?? new Date()) : null;
  const verificationId = demoId(ID_KIND.studentVerification, index);
  const documentRef = `demo-seed/${accountId}.pdf`;
  await ctx.studentDs.query(
    `INSERT INTO "student_verification"."student_verifications"
       ("id", "account_id", "school_name", "major", "document_ref", "status", "reviewer_id", "reason",
        "decided_at", "created_at", "revoked_at", "revocation_reason")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT ("id") DO UPDATE
       SET "account_id" = EXCLUDED."account_id", "school_name" = EXCLUDED."school_name",
           "major" = EXCLUDED."major", "document_ref" = EXCLUDED."document_ref",
           "status" = EXCLUDED."status", "reviewer_id" = EXCLUDED."reviewer_id",
           "reason" = EXCLUDED."reason", "decided_at" = EXCLUDED."decided_at",
           "created_at" = EXCLUDED."created_at", "revoked_at" = EXCLUDED."revoked_at",
           "revocation_reason" = EXCLUDED."revocation_reason", "updated_at" = now()`,
    [
      verificationId, accountId, schoolName, major ?? null, documentRef, status,
      reviewerId ?? null, reason ?? null, decided, submittedAt,
      revoked, revoked ? (revocationReason ?? 'Student status could not be re-confirmed') : null,
    ],
  );

  // The document the Administrator opens. `document_ref` above is what the download target is
  // signed from, so both rows must name the same object key (ADR-038).
  if (document) {
    await ctx.studentDs.query(
      `INSERT INTO "student_verification"."verification_documents"
         ("id", "account_id", "object_key", "file_name", "content_type", "size_bytes", "status", "created_at")
       VALUES ($1, $2, $3, $4, $5, $6, 'attached', $7)
       ON CONFLICT ("id") DO UPDATE
         SET "object_key" = EXCLUDED."object_key", "file_name" = EXCLUDED."file_name",
             "content_type" = EXCLUDED."content_type", "size_bytes" = EXCLUDED."size_bytes",
             "created_at" = EXCLUDED."created_at", "updated_at" = now()`,
      [demoId(ID_KIND.studentDocument, index), accountId, documentRef, document.fileName,
        document.contentType, document.sizeBytes, submittedAt],
    );
  }

  const occurredAt = revoked ?? decided ?? submittedAt ?? new Date();
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
 * Writes one evidence audit row, idempotently.
 *
 * `skill_evidence_audit` has no natural key, so a re-run would append a duplicate history. The id
 * is derived from the evidence and the row's ordinal, which makes the whole trail reproducible.
 */
async function insertEvidenceAudit(ctx, { index, evidenceId, profileSkillId, version, action, actorId, fromStatus, toStatus, reason, snapshot, occurredAt }) {
  await ctx.skillDs.query(
    `INSERT INTO "skill_verification"."skill_evidence_audit"
       ("id", "evidence_id", "profile_skill_id", "version", "action", "actor_id",
        "from_status", "to_status", "reason", "snapshot", "occurred_at")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT ("id") DO UPDATE
       SET "action" = EXCLUDED."action", "actor_id" = EXCLUDED."actor_id",
           "from_status" = EXCLUDED."from_status", "to_status" = EXCLUDED."to_status",
           "reason" = EXCLUDED."reason", "snapshot" = EXCLUDED."snapshot",
           "occurred_at" = EXCLUDED."occurred_at"`,
    [
      demoId(ID_KIND.evidenceAudit, index), evidenceId, profileSkillId, version, action,
      actorId ?? null, fromStatus ?? null, toStatus, reason ?? null,
      JSON.stringify(snapshot), occurredAt,
    ],
  );
}

/**
 * Writes an evidence version plus its audit trail (FR-003/FR-018/ADR-028) and, when approved,
 * mirrors the effective level into profile_skills and the live-class teacher_skill_approval
 * projection.
 *
 * The trail follows the real transitions rather than jumping straight to the result: a decided
 * version is `submitted` → `claimed` → `approved`/`rejected`, and a version replaced by a later
 * one ends `superseded`. That is what FR-018 asks the screen to retain.
 *
 * `suppressApproval` lets a caller record an approved version whose approval was later superseded,
 * without leaving `profile_skills.approved_level` pointing at a level the current evidence does
 * not support.
 */
async function upsertEvidence(ctx, {
  profileSkillId, accountId, skillId, version, status, requestedLevel, approvedLevel,
  evidenceType, description, claimedBy, reviewerId, evidenceIndex,
  submittedAt, decidedAt, reason,
}) {
  const submittedMs = submittedAt.getTime();
  const decided = decidedAt ?? null;
  const claimed = claimedBy ? new Date(submittedMs + 20 * 60 * 1000) : null;
  const evidenceId = demoId(ID_KIND.evidence, evidenceIndex);
  const refusal = reason ?? (status === 'rejected' ? 'Insufficient evidence' : null);

  await ctx.skillDs.query(
    `INSERT INTO "skill_verification"."skill_evidence"
       ("id", "profile_skill_id", "evidence_type", "document_ref", "description", "version",
        "requested_level", "approved_level", "status", "claimed_by", "claimed_at",
        "reviewer_id", "reason", "submitted_at", "decided_at")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT ("id") DO UPDATE
       SET "status" = EXCLUDED."status", "approved_level" = EXCLUDED."approved_level",
           "claimed_by" = EXCLUDED."claimed_by", "claimed_at" = EXCLUDED."claimed_at",
           "reviewer_id" = EXCLUDED."reviewer_id", "reason" = EXCLUDED."reason",
           "submitted_at" = EXCLUDED."submitted_at", "decided_at" = EXCLUDED."decided_at"`,
    [
      evidenceId, profileSkillId, evidenceType, null, description, version,
      requestedLevel, approvedLevel ?? null, status, claimedBy ?? null, claimed,
      reviewerId ?? null, refusal, submittedAt, decided,
    ],
  );

  const snapshot = {
    version,
    status,
    evidenceType,
    requestedLevel,
    approvedLevel: approvedLevel ?? null,
    reason: refusal,
  };
  const auditBase = evidenceIndex * 10;
  let auditStep = 1;

  await insertEvidenceAudit(ctx, {
    index: auditBase + auditStep,
    evidenceId, profileSkillId, version, action: 'submitted', actorId: accountId,
    fromStatus: null, toStatus: 'pending', snapshot, occurredAt: submittedAt,
  });

  if (claimed) {
    auditStep += 1;
    await insertEvidenceAudit(ctx, {
      index: auditBase + auditStep,
      evidenceId, profileSkillId, version, action: 'claimed', actorId: claimedBy,
      fromStatus: 'pending', toStatus: 'claimed', snapshot, occurredAt: claimed,
    });
  }

  if (status !== 'pending' && status !== 'claimed') {
    auditStep += 1;
    await insertEvidenceAudit(ctx, {
      index: auditBase + auditStep,
      evidenceId, profileSkillId, version, action: status,
      actorId: reviewerId ?? claimedBy ?? accountId,
      fromStatus: claimed ? 'claimed' : 'pending', toStatus: status,
      reason: refusal, snapshot, occurredAt: decided ?? submittedAt,
    });
  }

  if (status === 'approved' && approvedLevel) {
    await ctx.skillDs.query(
      `UPDATE "skill_verification"."profile_skills" SET "approved_level" = $2, "updated_at" = now()
       WHERE "id" = $1`,
      [profileSkillId, approvedLevel],
    );
    await ctx.classDs.query(
      `INSERT INTO "live_class"."teacher_skill_approval"
         ("account_id", "skill_id", "approved_level", "occurred_at", "updated_at")
       VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT ("account_id", "skill_id") DO UPDATE
         SET "approved_level" = EXCLUDED."approved_level", "occurred_at" = EXCLUDED."occurred_at", "updated_at" = now()`,
      [accountId, skillId, approvedLevel, decided ?? submittedAt],
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

/**
 * One in-class chat message (FR-012).
 *
 * `sender_role` is constrained to `learner`/`teacher` by `ck_chat_messages_sender_role`, and the
 * read path only ever shows messages to the booking's two parties — so every row written here
 * belongs to a real booking on the class it names.
 */
async function insertChatMessage(ctx, { index, classId, bookingId, senderId, senderRole, body, createdAt }) {
  await ctx.classDs.query(
    `INSERT INTO "live_class"."chat_messages"
       ("id", "class_id", "booking_id", "sender_id", "sender_role", "body", "created_at")
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT ("id") DO UPDATE SET "body" = EXCLUDED."body", "created_at" = EXCLUDED."created_at"`,
    [demoId(ID_KIND.chat, index), classId, bookingId, senderId, senderRole, body, createdAt],
  );
}

/**
 * Join/leave evidence (FR-011 / AC-035).
 *
 * `class_id` is **text** here and holds the bare class id, which is exactly what
 * `classIdFromRoom` extracts from the JaaS room name. The unique index
 * `uq_class_presence_open_session` allows only one open session per account per class, so an
 * open row (`left_at` null) is the only record of "still in the room".
 */
async function insertPresence(ctx, { index, classId, accountId, joinedAt, leftAt }) {
  await ctx.classDs.query(
    `INSERT INTO "live_class"."class_presence"
       ("id", "class_id", "account_id", "joined_at", "left_at", "created_at")
     VALUES ($1, $2, $3, $4, $5, $4)
     ON CONFLICT ("id") DO UPDATE
       SET "joined_at" = EXCLUDED."joined_at", "left_at" = EXCLUDED."left_at"`,
    [demoId(ID_KIND.presence, index), classId, accountId, joinedAt, leftAt ?? null],
  );
}

/** A rating (FR-013). One per booking — `uq_ratings_booking_id` — so the loop can never duplicate. */
async function insertRating(ctx, { index, bookingId, classId, learnerId, stars, comment, createdAt }) {
  await ctx.classDs.query(
    `INSERT INTO "live_class"."ratings"
       ("id", "booking_id", "class_id", "learner_id", "stars", "comment", "created_at")
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT ("id") DO UPDATE
       SET "stars" = EXCLUDED."stars", "comment" = EXCLUDED."comment",
           "created_at" = EXCLUDED."created_at"`,
    [demoId(ID_KIND.rating, index), bookingId, classId, learnerId, stars, comment, createdAt],
  );
}

/** The "class starting soon" lease (FR-016). Primary key is (class_id, kind). */
async function insertReminder(ctx, { classId, kind, sentAt }) {
  await ctx.classDs.query(
    `INSERT INTO "live_class"."class_reminders" ("class_id", "kind", "sent_at")
     VALUES ($1, $2, $3)
     ON CONFLICT ("class_id", "kind") DO UPDATE SET "sent_at" = EXCLUDED."sent_at"`,
    [classId, kind, sentAt],
  );
}

/** A refused room entry, recorded for the Administrator (reason ∈ ROOM_ACCESS_DENIALS). */
async function insertIncident(ctx, { index, bookingId, classId, requesterId, reason, createdAt }) {
  await ctx.classDs.query(
    `INSERT INTO "live_class"."room_access_incidents"
       ("id", "booking_id", "class_id", "requester_id", "reason", "trace_id", "created_at")
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT ("id") DO UPDATE SET "reason" = EXCLUDED."reason", "created_at" = EXCLUDED."created_at"`,
    [demoId(ID_KIND.incident, index), bookingId, classId, requesterId, reason, `${DEMO_REF_PREFIX}trace-${index}`, createdAt],
  );
}

/**
 * One inbox notification (FR-016).
 *
 * The six types and four target types are CHECK-constrained, and every row carries the
 * `deduplication_key` the production consumer derives (`<eventId>:<accountId>`), so seeding the
 * same notification twice is a no-op instead of a duplicate.
 */
async function insertNotification(ctx, { index, accountId, type, targetType, targetId, dedupeKey, read, createdAt }) {
  await ctx.accountDs.query(
    `INSERT INTO "account_profile"."inbox_notifications"
       ("id", "account_id", "deduplication_key", "type", "title", "body",
        "target_type", "target_id", "read", "created_at")
     VALUES ($1, $2, $3, $4, $4, $4, $5, $6, $7, $8)
     ON CONFLICT ("deduplication_key") DO UPDATE
       SET "read" = EXCLUDED."read", "created_at" = EXCLUDED."created_at"`,
    [
      demoId(ID_KIND.notification, index), accountId, `${DEMO_REF_PREFIX}${dedupeKey}`,
      type, targetType, targetId, read, createdAt,
    ],
  );
  const rows = await ctx.accountDs.query(
    `SELECT "id" FROM "account_profile"."inbox_notifications" WHERE "deduplication_key" = $1`,
    [`${DEMO_REF_PREFIX}${dedupeKey}`],
  );
  return rows[0].id;
}

/**
 * One registered push installation.
 *
 * `is_active` is **false**: these tokens are demo strings, not real Expo tokens, and an active row
 * would make the push worker attempt a delivery to a token that cannot exist. The delivery history
 * below is still seeded — `push_deliveries` only needs the row to exist — so the retry path is
 * visible without anything actually being sent.
 */
async function insertDevice(ctx, { index, accountId, platform, locale, appVersion, createdAt }) {
  const installationId = `${DEMO_REF_PREFIX}install-${index}`;
  await ctx.accountDs.query(
    `INSERT INTO "account_profile"."notification_devices"
       ("id", "account_id", "token", "platform", "installation_id", "app_version", "locale", "is_active", "created_at")
     VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
     ON CONFLICT ("installation_id") DO UPDATE
       SET "account_id" = EXCLUDED."account_id", "token" = EXCLUDED."token",
           "platform" = EXCLUDED."platform", "app_version" = EXCLUDED."app_version",
           "locale" = EXCLUDED."locale", "created_at" = EXCLUDED."created_at",
           "is_active" = false, "updated_at" = now()`,
    [
      demoId(ID_KIND.device, index), accountId,
      `${DEMO_REF_PREFIX}token-${platform}-${index}`, platform, installationId,
      appVersion, locale, createdAt,
    ],
  );
  return demoId(ID_KIND.device, index);
}

/**
 * One outbound push attempt for an inbox row.
 *
 * `push_deliveries` is unique on (notification_id, device_id), so an attempt is identified by the
 * pair rather than by a generated id — that is also what makes the status visible per device.
 */
async function insertPushDelivery(ctx, { notificationId, deviceId, status, attempts, providerTicketId, lastError, createdAt }) {
  await ctx.accountDs.query(
    `INSERT INTO "account_profile"."push_deliveries"
       ("notification_id", "device_id", "status", "attempts", "provider_ticket_id", "last_error",
        "next_attempt_at", "created_at", "updated_at")
     VALUES ($1, $2, $3, $4, $5, $6, now(), $7, $7)
     ON CONFLICT ("notification_id", "device_id") DO UPDATE
       SET "status" = EXCLUDED."status", "attempts" = EXCLUDED."attempts",
           "provider_ticket_id" = EXCLUDED."provider_ticket_id",
           "last_error" = EXCLUDED."last_error", "created_at" = EXCLUDED."created_at"`,
    [notificationId, deviceId, status, attempts, providerTicketId ?? null, lastError ?? null, createdAt],
  );
}

/**
 * One audit row, idempotently.
 *
 * The store is append-only — the module's role has `UPDATE, DELETE` revoked (see `resetDemo`) — so
 * a re-run cannot clear demo audit rows the way every other table is cleared. `source_event_id` is
 * unique where not null, exactly as it is for the production consumer, and the insert is keyed on
 * it: the statement is a no-op when the row already exists instead of failing the whole seed.
 */
async function insertAuditEvent(ctx, { action, actorId, targetType, targetId, oldState, newState, metadata, occurredAt, key }) {
  await ctx.adminDs.query(
    `INSERT INTO "admin_operation"."admin_audit_event"
       ("action", "actor_id", "target_type", "target_id", "old_state", "new_state",
        "occurred_at", "trace_id", "metadata", "source_event_id")
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, $9)
     ON CONFLICT ("source_event_id") WHERE "source_event_id" IS NOT NULL DO NOTHING`,
    [
      action,
      actorId ?? null,
      targetType,
      targetId ?? null,
      oldState === undefined ? null : JSON.stringify(oldState),
      newState === undefined ? null : JSON.stringify(newState),
      occurredAt,
      metadata === undefined ? null : JSON.stringify(metadata),
      `${DEMO_REF_PREFIX}${key}`,
    ],
  );
}

/**
 * A minimal one-page PDF carrying the account id, so an uploaded document is visibly a demo file
 * rather than an empty placeholder. The bytes are assembled by hand because the seed has no PDF
 * library and adding one for a few hundred bytes would be a dependency for nothing.
 */
function demoPdf(accountId, label) {
  const text = `SkillSwap demo document - ${label} - account ${accountId}`;
  const stream = `BT /F1 12 Tf 40 760 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

/**
 * Uploads one demo document through the **same** signing helpers the API uses, so the object key
 * stored in the seed is reachable by the URL `read-verification-document` will later sign.
 *
 * Cloudinary requires `authenticated` delivery and a `raw` resource for PDFs; both come from
 * `shared/storage/cloudinary-sign` rather than being re-derived here (ADR-038).
 */
async function uploadDemoDocument({ objectKey, bytes, contentType }) {
  const sign = await import(
    pathToFileURL(join(ROOT, 'apps', 'api', 'dist', 'shared', 'storage', 'cloudinary-sign.js')).href
  );
  const resourceType = sign.resourceTypeFor(contentType);
  const timestamp = Math.floor(Date.now() / 1000);
  const signedFields = {
    timestamp: String(timestamp),
    public_id: sign.publicIdFor(objectKey, resourceType),
    type: 'authenticated',
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(signedFields)) form.append(key, value);
  form.append('api_key', config.cloudinaryApiKey);
  form.append('signature', sign.signFields(signedFields, config.cloudinaryApiSecret));
  form.append('file', new Blob([bytes], { type: contentType }), objectKey.split('/').pop());
  const response = await fetch(sign.uploadUrlFor(
    { cloudName: config.cloudinaryCloudName, apiKey: config.cloudinaryApiKey, apiSecret: config.cloudinaryApiSecret },
    resourceType,
  ), { method: 'POST', body: form });
  if (!response.ok) {
    throw new Error(`Cloudinary upload failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
  }
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

  // One clock anchor for the whole seed. Everything below is expressed relative to it, so the
  // dataset reads as three weeks of use rather than one `now()` repeated down every table.
  const HOUR = 3600 * 1000;
  const DAY = 24 * HOUR;
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();

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
    await upsertVerifier(ctx.skillDs, ACCOUNT_ID[verifier.email], skillIds, verifier.status ?? 'active');
  }
  console.log(`verifiers: ${VERIFIERS.length} with expertise`);

  // FR-002: verifications across every status, each on the timeline below. Users 1–6 are approved
  // students (the candidate teachers). User 7 is waiting, user 8 was refused, user 9 was approved
  // and has since been **revoked**.
  //
  // Revocation mutates the row rather than appending one (`sql-verification-repository.ts`
  // `revoke`), so the history is the `decided_at`/`revoked_at` pair on a single row — not two rows
  // claiming the same account.
  const adminId = ACCOUNT_ID[ADMIN.email];
  const USER_STATUS = [
    'approved', 'approved', 'approved', 'approved', 'approved', 'approved',
    'pending', 'rejected', 'revoked', 'pending',
  ];
  const userIdByIndex = USERS.map((u) => ACCOUNT_ID[u.email]);
  for (let i = 0; i < USERS.length; i += 1) {
    const status = USER_STATUS[i];
    const decidedOn = now - (32 - i * 2) * DAY;
    const submittedOn = now - (41 - i * 2) * DAY;
    await upsertStudentVerification(ctx, {
      accountId: userIdByIndex[i],
      schoolName: `Demo University ${1 + (i % 3)}`,
      major: ['Computer Science', 'Business', 'Languages'][i % 3],
      status,
      reviewerId: status === 'pending' ? undefined : adminId,
      reason: status === 'rejected' ? 'Document could not be verified' : undefined,
      index: i + 1,
      submittedAt: new Date(submittedOn),
      decidedAt: status === 'pending' ? undefined : new Date(decidedOn),
      ...(status === 'revoked'
        ? {
            revokedAt: new Date(now - 3 * DAY),
            revocationReason: 'Re-submitted student card did not match the enrolled programme',
          }
        : {}),
      document: {
        fileName: `student-card-${i + 1}.pdf`,
        contentType: 'application/pdf',
        sizeBytes: 180_000 + i * 9_500,
      },
    });
  }
  // An account the Administrator has locked. `accounts` demands a reason and a timestamp together
  // whenever the status is suspended (ADR-037).
  await suspendAccount(
    ctx.accountDs,
    userIdByIndex[9],
    'Chargeback investigation opened by the payment provider',
    new Date(now - 2 * DAY),
  );
  console.log(`student verifications: ${USERS.length} (users 7–10 cover pending, rejected and revoked)`);

  // FR-002 document open: upload the files the verifications point at, when asked and configured.
  // `read-verification-document` signs a URL from `document_ref`, so without a real object behind
  // that key the admin's "open document" action is a 404 — stated here rather than hidden.
  if (UPLOAD_DOCUMENTS) {
    const placeholderCreds =
      config.cloudinaryApiKey === 'skillswap_dev_key' ||
      config.cloudinaryApiSecret === 'skillswap_dev_secret';
    if (placeholderCreds) {
      console.warn('upload: skipped — CLOUDINARY_* is unset, so the admin document link will 404');
    } else {
      let uploaded = 0;
      for (let i = 0; i < USERS.length; i += 1) {
        const accountId = userIdByIndex[i];
        await uploadDemoDocument({
          objectKey: `demo-seed/${accountId}.pdf`,
          bytes: demoPdf(accountId, `student card ${i + 1}`),
          contentType: 'application/pdf',
        });
        uploaded += 1;
      }
      console.log(`upload: ${uploaded} demo documents stored in Cloudinary`);
    }
  }

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

  // A decision is made by a verifier who actually owns that skill: the queue is filtered by
  // `verifier_expertise`, so an approval from someone outside it would be a state the real flow
  // cannot reach (and the demo would show an expert approving something they do not review).
  const SKILL_VERIFIER = {
    IELTS: 0,
    'English Conversation': 0,
    Japanese: 0,
    Python: 1,
    React: 1,
    TypeScript: 1,
    Calculus: 1,
    Guitar: 2,
    Piano: 2,
  };
  const verifierIdFor = (skillName) => {
    const index = SKILL_VERIFIER[skillName];
    if (index === undefined) throw new Error(`No verifier owns "${skillName}"`);
    return ACCOUNT_ID[VERIFIERS[index].email];
  };

  // Skills whose single approved version is written by a history block below instead of the simple
  // loop, so a profile skill never ends up with two version-1 rows or two `approved` rows.
  const HISTORY_SKILLS = new Set(['Piano:4', 'Calculus:5']);

  let profileSkillSeq = 0;
  let evidenceSeq = 0;
  for (const t of TEACHING) {
    const accountId = userIdByIndex[t.user];
    for (let s = 0; s < t.skills.length; s += 1) {
      const skillName = t.skills[s];
      if (HISTORY_SKILLS.has(`${skillName}:${t.user}`)) continue;
      const skillId = skillIdByName[skillName];
      const level = LEVELS[(t.user + s) % LEVELS.length];
      const submittedAt = new Date(now - (48 - t.user * 2 - s) * DAY);
      const decidedAt = new Date(submittedAt.getTime() + 2 * DAY);
      profileSkillSeq += 1;
      evidenceSeq += 1;
      const profileSkillId = await upsertProfileSkill(ctx.skillDs, accountId, skillId, profileSkillSeq);
      await upsertEvidence(ctx, {
        profileSkillId, accountId, skillId, version: 1, status: 'approved',
        requestedLevel: level, approvedLevel: level,
        evidenceType: 'certificate', description: `Demo certificate for ${skillName}`,
        claimedBy: verifierIdFor(skillName), reviewerId: verifierIdFor(skillName),
        evidenceIndex: evidenceSeq, submittedAt, decidedAt,
      });
    }
  }

  // FR-018 history: a request that was refused and then granted on resubmission. Both versions
  // live on one profile skill, so the screen can show why the first attempt failed.
  const historyEvidence = {};
  {
    const accountId = userIdByIndex[4];
    const skillId = skillIdByName.Piano;
    const profileSkillId = await upsertProfileSkill(ctx.skillDs, accountId, skillId, ++profileSkillSeq);
    const rejectedId = await upsertEvidence(ctx, {
      profileSkillId, accountId, skillId, version: 1, status: 'rejected',
      requestedLevel: 'expert', approvedLevel: null,
      evidenceType: 'certificate', description: 'Grade 8 piano certificate (photo of a screen)',
      claimedBy: verifierIdFor('Piano'), reviewerId: verifierIdFor('Piano'),
      evidenceIndex: ++evidenceSeq,
      submittedAt: new Date(now - 30 * DAY),
      decidedAt: new Date(now - 28 * DAY),
      reason: 'The certificate image was a photo of a screen and the grade was unreadable',
    });
    const approvedId = await upsertEvidence(ctx, {
      profileSkillId, accountId, skillId, version: 2, status: 'approved',
      requestedLevel: 'intermediate', approvedLevel: 'intermediate',
      evidenceType: 'verifier_assessment', description: 'Live assessment: scales and a short piece',
      claimedBy: verifierIdFor('Piano'), reviewerId: verifierIdFor('Piano'),
      evidenceIndex: ++evidenceSeq,
      submittedAt: new Date(now - 20 * DAY),
      decidedAt: new Date(now - 18 * DAY),
    });
    historyEvidence.piano = { profileSkillId, rejectedId, approvedId };
  }

  // FR-018 history: an approved level that a later, higher approval replaced. The old row is
  // `superseded` rather than deleted, which is exactly what the audit screen is for. The skill must
  // be one this teacher already owns (`profile_skills` is unique on account+skill), and the simple
  // loop above skips it via HISTORY_SKILLS so the profile does not get a third, competing version.
  {
    const accountId = userIdByIndex[5];
    const skillId = skillIdByName.Calculus;
    const profileSkillId = await upsertProfileSkill(ctx.skillDs, accountId, skillId, ++profileSkillSeq);
    const firstSubmitted = new Date(now - 58 * DAY);
    const firstDecided = new Date(now - 56 * DAY);
    const firstEvidenceId = await upsertEvidence(ctx, {
      profileSkillId, accountId, skillId, version: 1, status: 'approved',
      requestedLevel: 'beginner', approvedLevel: 'beginner',
      evidenceType: 'certificate', description: 'Calculus I transcript, grade B',
      claimedBy: verifierIdFor('Calculus'), reviewerId: verifierIdFor('Calculus'),
      evidenceIndex: ++evidenceSeq, submittedAt: firstSubmitted, decidedAt: firstDecided,
    });
    const supersededAt = new Date(now - 40 * DAY);
    await ctx.skillDs.query(
      `UPDATE "skill_verification"."skill_evidence" SET "status" = 'superseded' WHERE "id" = $1`,
      [firstEvidenceId],
    );
    await insertEvidenceAudit(ctx, {
      index: evidenceSeq * 10 + 9,
      evidenceId: firstEvidenceId, profileSkillId, version: 1, action: 'superseded',
      actorId: verifierIdFor('Calculus'), fromStatus: 'approved', toStatus: 'superseded',
      reason: 'Replaced by a higher-level assessment',
      snapshot: { version: 1, status: 'superseded', requestedLevel: 'beginner', approvedLevel: 'beginner' },
      occurredAt: supersededAt,
    });
    await upsertEvidence(ctx, {
      profileSkillId, accountId, skillId, version: 2, status: 'approved',
      requestedLevel: 'expert', approvedLevel: 'expert',
      evidenceType: 'verifier_assessment', description: 'Calculus II and III transcripts plus a timed assessment',
      claimedBy: verifierIdFor('Calculus'), reviewerId: verifierIdFor('Calculus'),
      evidenceIndex: ++evidenceSeq,
      submittedAt: new Date(now - 42 * DAY),
      decidedAt: supersededAt,
    });
  }

  // A live verifier queue. Every claimant is an **approved** student submitting a *second* skill:
  // `SubmitSkillEvidenceUseCase` refuses anyone whose `verified_students` row is not `approved`, so
  // a queue built on the pending/rejected/revoked users above would be a state the API cannot
  // produce. Each claim names a verifier who actually owns that skill in `verifier_expertise`.
  const queueSeeds = [
    { user: 0, skillName: 'Japanese', status: 'pending', claimedBy: null, ageDays: 2 },
    { user: 1, skillName: 'React', status: 'claimed', claimedBy: verifierIdFor('React'), ageDays: 4 },
    { user: 2, skillName: 'Python', status: 'claimed', claimedBy: verifierIdFor('Python'), ageDays: 1 },
    { user: 3, skillName: 'IELTS', status: 'pending', claimedBy: null, ageDays: 3 },
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
      claimedBy: q.claimedBy, reviewerId: null, evidenceIndex: evidenceSeq,
      submittedAt: new Date(now - q.ageDays * DAY),
      decidedAt: undefined,
    });
  }
  console.log(`skill evidence: ${evidenceSeq} rows (${[...HISTORY_SKILLS].length} profile skills carry version history)`);

  // ── FR-005/FR-007: classes + bookings ────────────────────────────────────
  // Teachers are users 0–5. Class states cover the whole lifecycle — all six values the CHECK
  // allows — and each class is placed on the same backdated timeline as the trust history above,
  // so the demo reads as three weeks of use instead of one timestamp repeated down every table.

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

  // ── FR-011/FR-012/FR-013/FR-016: the classroom's own history ─────────────
  // Everything here is derived from the bookings above, so a rating cannot exist without the
  // confirmed booking it rates, and chat/presence cannot exist without the class's parties.
  const completed = classIds.filter((c) => c.spec.state === 'completed');
  const inProgress = classIds.find((c) => c.spec.state === 'in_progress');
  const soon = classIds.find((c) => c.spec.startInH === 2);

  const RATING_TEXT = {
    5: 'Explained it slowly and checked that I understood before moving on.',
    4: 'Good pace and useful examples. Would take another class.',
    3: 'The content was right but we ran out of time for questions.',
    2: 'Hard to follow in places; the slides had a lot on them.',
  };

  let ratingSeq = 0;
  let ratedCount = 0;
  for (const cls of completed) {
    const clsBookings = bookings.filter((b) => b.classId === cls.classId && b.state === 'confirmed');
    const endMs = cls.startsAtMs + cls.spec.duration * 60 * 1000;
    for (let i = 0; i < clsBookings.length; i += 1) {
      // Leave the newest finished class's last booking unrated: that is the "rate this class"
      // row the demo needs on /my-bookings, and it is what makes the flow demonstrable.
      const isNewest = cls === completed[completed.length - 1];
      if (isNewest && i === clsBookings.length - 1) continue;
      const stars = [5, 4, 5, 3, 4][(ratingSeq + i) % 5];
      ratingSeq += 1;
      await insertRating(ctx, {
        index: ratingSeq,
        bookingId: clsBookings[i].bookingId,
        classId: cls.classId,
        learnerId: clsBookings[i].learnerId,
        stars,
        comment: RATING_TEXT[stars],
        createdAt: iso(endMs + (1 + i) * DAY),
      });
      ratedCount += 1;
    }
  }

  // Chat history: a full transcript on the last finished class, and a live one in the room that
  // is running right now. `sender_role` alternates learner/teacher with the booking's own parties.
  let chatSeq = 0;
  const transcriptClass = completed[completed.length - 1];
  const transcriptBooking = bookings.find(
    (b) => b.classId === transcriptClass.classId && b.state === 'confirmed',
  );
  const transcriptTeacher = TEACHER_SKILLS.find((t) => t.teacher === transcriptClass.spec.teacher).teacherId;
  const transcriptStart = transcriptClass.startsAtMs;
  const TRANSCRIPT = [
    ['teacher', 'Welcome! We will start with the warm-up in a moment.', 0],
    ['learner', 'Ready. I had a question about the last exercise.', 3],
    ['teacher', 'Ask away — I will answer it before we move on.', 4],
    ['learner', 'How do I keep my fingers from muting the next string?', 6],
    ['teacher', 'Angle your fingertips more; I will show it on camera.', 7],
  ];
  for (const [role, body, minutes] of TRANSCRIPT) {
    chatSeq += 1;
    await insertChatMessage(ctx, {
      index: chatSeq,
      classId: transcriptClass.classId,
      bookingId: transcriptBooking.bookingId,
      senderId: role === 'teacher' ? transcriptTeacher : transcriptBooking.learnerId,
      senderRole: role,
      body,
      createdAt: iso(transcriptStart + minutes * 60 * 1000),
    });
  }

  // Presence: closed sessions for the finished classes (this is the join evidence no-show
  // detection reads), and open sessions in the class that is running right now.
  let presenceSeq = 0;
  for (const cls of completed) {
    const endMs = cls.startsAtMs + cls.spec.duration * 60 * 1000;
    const teacherId = TEACHER_SKILLS.find((t) => t.teacher === cls.spec.teacher).teacherId;
    presenceSeq += 1;
    const joinedAt = iso(cls.startsAtMs);
    const leftAt = iso(endMs);
    await insertPresence(ctx, { index: presenceSeq, classId: cls.classId, accountId: teacherId, joinedAt, leftAt });
    for (const b of bookings.filter((x) => x.classId === cls.classId && x.state === 'confirmed')) {
      presenceSeq += 1;
      await insertPresence(ctx, {
        index: presenceSeq,
        classId: cls.classId,
        accountId: b.learnerId,
        joinedAt: iso(cls.startsAtMs + 2 * 60 * 1000),
        leftAt,
      });
    }
  }
  if (inProgress) {
    const teacherId = TEACHER_SKILLS.find((t) => t.teacher === inProgress.spec.teacher).teacherId;
    presenceSeq += 1;
    await insertPresence(ctx, {
      index: presenceSeq,
      classId: inProgress.classId,
      accountId: teacherId,
      joinedAt: iso(inProgress.startsAtMs),
      leftAt: null,
    });
    const liveBooking = bookings.find((b) => b.classId === inProgress.classId && b.state === 'confirmed');
    if (liveBooking) {
      presenceSeq += 1;
      await insertPresence(ctx, {
        index: presenceSeq,
        classId: inProgress.classId,
        accountId: liveBooking.learnerId,
        joinedAt: iso(inProgress.startsAtMs + 60 * 1000),
        leftAt: null,
      });
      // A learner already left, so the room shows a mix of present and departed participants.
      presenceSeq += 1;
      await insertPresence(ctx, {
        index: presenceSeq,
        classId: inProgress.classId,
        accountId: bookings.filter((b) => b.classId === inProgress.classId && b.state === 'confirmed')[1]?.learnerId ?? liveBooking.learnerId,
        joinedAt: iso(inProgress.startsAtMs + 2 * 60 * 1000),
        leftAt: iso(inProgress.startsAtMs + 20 * 60 * 1000),
      });
    }
  }

  // The reminder lease for the class that starts in two hours, so the "starting soon" path has
  // already fired and the scheduler will not fire it again during the demo.
  if (soon) {
    await insertReminder(ctx, {
      classId: soon.classId,
      kind: 'starting_soon',
      sentAt: iso(soon.startsAtMs - 15 * 60 * 1000),
    });
  }

  // Refused room entries. Both are real refusal reasons from `ROOM_ACCESS_DENIALS`, and both name
  // a booking, because the recorder is only ever reached through one.
  let incidentSeq = 0;
  const firstOpenBooking = bookings.find((b) => b.state === 'confirmed' && b.spec.startInH > 0);
  if (firstOpenBooking) {
    incidentSeq += 1;
    await insertIncident(ctx, {
      index: incidentSeq,
      bookingId: firstOpenBooking.bookingId,
      classId: firstOpenBooking.classId,
      requesterId: firstOpenBooking.learnerId,
      reason: 'window_not_open',
      createdAt: iso(now - 2 * HOUR),
    });
  }
  if (inProgress) {
    incidentSeq += 1;
    await insertIncident(ctx, {
      index: incidentSeq,
      bookingId: `${DEMO_REF_PREFIX}no-booking`,
      classId: inProgress.classId,
      requesterId: ACCOUNT_ID[USERS[8].email],
      reason: 'not_a_party',
      createdAt: iso(inProgress.startsAtMs + 5 * 60 * 1000),
    });
  }
  console.log(`ratings: ${ratedCount}, chat: ${chatSeq}, presence: ${presenceSeq}, incidents: ${incidentSeq}`);

  // ── FR-016: inbox, installations, push attempts ──────────────────────────
  // Every notification is anchored to a row that exists above: a real booking, a real class, a
  // real ledger entry, a real verification. Nothing here can be opened to a 404.
  const devices = [];
  let deviceSeq = 0;
  const DEVICE_SPECS = [
    ...USERS.slice(0, 4).map((u, i) => ({ user: u, platform: ['ios', 'android', 'web'][i % 3], locale: i % 2 === 0 ? 'vi' : 'en', appVersion: '1.4.0' })),
    { user: USERS[6], platform: 'android', locale: 'vi', appVersion: '1.4.0' },
  ];
  for (const spec of DEVICE_SPECS) {
    deviceSeq += 1;
    const deviceId = await insertDevice(ctx, {
      index: deviceSeq,
      accountId: ACCOUNT_ID[spec.user.email],
      platform: spec.platform,
      locale: spec.locale,
      appVersion: spec.appVersion,
      createdAt: iso(now - 20 * DAY),
    });
    devices.push({ deviceId, accountId: ACCOUNT_ID[spec.user.email], platform: spec.platform });
  }

  let notificationSeq = 0;
  let pushSeq = 0;
  const notify = async (spec) => {
    notificationSeq += 1;
    const notificationId = await insertNotification(ctx, { ...spec, index: notificationSeq });
    // One delivery per active installation of the recipient, which is what the worker fans out.
    for (const device of devices.filter((d) => d.accountId === spec.accountId)) {
      pushSeq += 1;
      const failed = pushSeq % 5 === 0;
      await insertPushDelivery(ctx, {
        notificationId,
        deviceId: device.deviceId,
        status: failed ? 'failed' : 'accepted',
        attempts: failed ? 3 : 1,
        providerTicketId: failed ? null : `demo-seed-ticket-${pushSeq}`,
        lastError: failed ? 'DeviceNotRegistered' : null,
        createdAt: spec.createdAt,
      });
    }
    return notificationId;
  };

  // An inbox for each user, with a spread of read/unread and ages so the unread badge and the
  // "mark all read" action both have something to act on.
  for (let i = 0; i < USERS.length; i += 1) {
    const accountId = userIdByIndex[i];
    const owned = bookings.filter((b) => b.learnerId === accountId && b.state === 'confirmed');
    const upcoming = owned.find((b) => b.spec.startInH > 0) ?? owned[0];
    if (upcoming) {
      await notify({
        accountId, type: 'booking_confirmed', targetType: 'booking', targetId: upcoming.bookingId,
        dedupeKey: `notify-booking-${i}`, read: i % 3 !== 0,
        createdAt: iso(now - (12 - i) * DAY),
      });
    }
    await notify({
      accountId, type: 'verification_outcome', targetType: 'verification',
      targetId: demoId(ID_KIND.studentVerification, i + 1),
      dedupeKey: `notify-verification-${i}`, read: i % 2 === 0,
      createdAt: iso(now - (14 - i) * DAY),
    });
    await notify({
      accountId, type: 'wallet_transaction', targetType: 'wallet',
      targetId: `${DEMO_REF_PREFIX}topup-user${i + 1}`, dedupeKey: `notify-wallet-${i}`,
      read: i > 5, createdAt: iso(now - (10 - i) * DAY),
    });
  }

  // The teacher side of a reminder, and a cancellation notice, so both message kinds are visible.
  if (soon) {
    const teacherId = TEACHER_SKILLS.find((t) => t.teacher === soon.spec.teacher).teacherId;
    await notify({
      accountId: teacherId, type: 'class_starting_soon', targetType: 'class',
      targetId: soon.classId, dedupeKey: 'notify-soon-teacher', read: false,
      createdAt: iso(soon.startsAtMs - 15 * 60 * 1000),
    });
    for (const b of bookings.filter((x) => x.classId === soon.classId && x.state === 'confirmed')) {
      await notify({
        accountId: b.learnerId, type: 'class_starting_soon', targetType: 'class',
        targetId: soon.classId, dedupeKey: `notify-soon-${b.bookingId}`, read: false,
        createdAt: iso(soon.startsAtMs - 15 * 60 * 1000),
      });
    }
  }
  const cancelledClass = classIds.find((c) => c.spec.state === 'cancelled');
  if (cancelledClass) {
    for (const b of bookings.filter((x) => x.classId === cancelledClass.classId)) {
      await notify({
        accountId: b.learnerId, type: 'booking_cancelled', targetType: 'booking',
        targetId: b.bookingId, dedupeKey: `notify-cancel-${b.bookingId}`, read: true,
        createdAt: iso(cancelledClass.startsAtMs - 2 * DAY),
      });
    }
  }
  // `withdrawal_outcome` is deliberately absent: FR-014 is deferred and the SRS records that the
  // type is declared with no producer. Seeding one would invent a notification the product cannot
  // send, so the inbox covers the five types that actually have a producer.
  console.log(`notifications: ${notificationSeq}, devices: ${devices.length}, push deliveries: ${pushSeq}`);

  // ── FR-015: the audit trail ───────────────────────────────────────────────
  // One row per audited action in `audit-actions.ts`, with the same target types and the same
  // old→new shape that consumer writes. `actorId` is the person who acted, never the subject.
  const auditedVerification = demoId(ID_KIND.studentVerification, 9);
  await insertAuditEvent(ctx, {
    action: 'student.verification.approved', actorId: adminId, targetType: 'verification',
    targetId: auditedVerification, oldState: null,
    newState: { status: 'approved', schoolName: 'Demo University 3', reason: null },
    occurredAt: iso(now - 14 * DAY), key: 'audit-verification-approved',
  });
  await insertAuditEvent(ctx, {
    action: 'student.verification.rejected', actorId: adminId, targetType: 'verification',
    targetId: demoId(ID_KIND.studentVerification, 8), oldState: null,
    newState: { status: 'rejected', schoolName: 'Demo University 2', reason: 'Document could not be verified' },
    occurredAt: iso(now - 16 * DAY), key: 'audit-verification-rejected',
  });
  await insertAuditEvent(ctx, {
    action: 'student.verification.revoked', actorId: adminId, targetType: 'verification',
    targetId: auditedVerification, oldState: null,
    newState: {
      status: 'revoked', schoolName: 'Demo University 3',
      reason: 'Re-submitted student card did not match the enrolled programme',
    },
    occurredAt: iso(now - 3 * DAY), key: 'audit-verification-revoked',
  });
  await insertAuditEvent(ctx, {
    action: 'student.verification.document.read', actorId: adminId,
    targetType: 'verification_document', targetId: demoId(ID_KIND.studentVerification, 7),
    oldState: null, newState: null,
    metadata: { actorRole: 'admin', documentRef: `demo-seed/${userIdByIndex[6]}.pdf` },
    occurredAt: iso(now - 13 * DAY), key: 'audit-verification-document-read',
  });
  await insertAuditEvent(ctx, {
    action: 'skill.verifier.suspended', actorId: adminId, targetType: 'verifier_account',
    targetId: ACCOUNT_ID[VERIFIERS[3].email], oldState: { status: 'active' },
    newState: { status: 'suspended' }, occurredAt: iso(now - 9 * DAY), key: 'audit-verifier-suspended',
  });
  await insertAuditEvent(ctx, {
    action: 'skill.verifier.revoked', actorId: adminId, targetType: 'verifier_account',
    targetId: ACCOUNT_ID[VERIFIERS[4].email], oldState: { status: 'suspended' },
    newState: { status: 'revoked' }, occurredAt: iso(now - 8 * DAY), key: 'audit-verifier-revoked',
  });
  await insertAuditEvent(ctx, {
    action: 'account.status.changed', actorId: adminId, targetType: 'account',
    targetId: userIdByIndex[9], oldState: { status: 'active' },
    newState: { status: 'suspended', reason: 'Chargeback investigation opened by the payment provider' },
    occurredAt: iso(now - 2 * DAY), key: 'audit-account-suspended',
  });
  await insertAuditEvent(ctx, {
    action: 'skill.evidence.document.read', actorId: ACCOUNT_ID[VERIFIERS[2].email],
    targetType: 'skill_evidence_document',
    targetId: historyEvidence.piano.rejectedId,
    oldState: null, newState: null,
    metadata: { actorRole: 'verifier', documentRef: `demo-seed/${userIdByIndex[4]}.pdf` },
    occurredAt: iso(now - 29 * DAY), key: 'audit-evidence-document-read',
  });
  // The two evidence decisions the Piano version history is built from, plus the claim that
  // preceded them, so a filtered "skill evidence" view has a full story rather than a result.
  for (const [key, action, evidenceId, at, extra] of [
    ['audit-evidence-claimed', 'skill.evidence.claimed', historyEvidence.piano.rejectedId, now - 29 * DAY, { status: 'claimed' }],
    ['audit-evidence-rejected', 'skill.evidence.rejected', historyEvidence.piano.rejectedId, now - 28 * DAY, { status: 'rejected', reason: 'The certificate image was a photo of a screen and the grade was unreadable' }],
    ['audit-evidence-approved', 'skill.evidence.approved', historyEvidence.piano.approvedId, now - 18 * DAY, { status: 'approved' }],
  ]) {
    const approved = extra.status === 'approved';
    await insertAuditEvent(ctx, {
      action, actorId: ACCOUNT_ID[VERIFIERS[2].email], targetType: 'skill_evidence',
      targetId: evidenceId, oldState: null,
      newState: {
        ...extra,
        skillId: skillIdByName.Piano,
        version: approved ? 2 : 1,
        requestedLevel: approved ? 'intermediate' : 'expert',
        approvedLevel: approved ? 'intermediate' : null,
      },
      metadata: { profileSkillId: historyEvidence.piano.profileSkillId },
      occurredAt: iso(at), key,
    });
  }
  // One settlement row, which is what the production consumer writes with SYSTEM_ACTOR_ID.
  const firstRelease = bookings.find((b) => b.spec.state === 'completed' && b.state === 'confirmed');
  if (firstRelease) {
    await insertAuditEvent(ctx, {
      action: 'wallet.transaction.completed',
      actorId: '00000000-0000-4000-8000-000000000000',
      targetType: 'wallet_transaction', targetId: `${DEMO_REF_PREFIX}release-${firstRelease.bookingId}`,
      oldState: null,
      newState: { type: 'release', direction: 'credit', amountCredits: splitSettlement(firstRelease.spec.price).teacherCredits },
      metadata: { bookingId: firstRelease.bookingId },
      occurredAt: iso(firstRelease.startsAtMs + firstRelease.spec.duration * 60 * 1000),
      key: 'audit-wallet-release',
    });
  }
  console.log('audit: every audited action in audit-actions.ts is represented');

  await reportCounts(ctx);

  console.log('\nDemo credentials (password for every account: ' + DEMO_PASSWORD + ')');
  console.log(`  admin     ${ADMIN.email}`);
  for (const v of VERIFIERS) console.log(`  verifier  ${v.email}`);
  console.log(`  user      ${USERS[0].email} … ${USERS[USERS.length - 1].email}`);

  // What each account is for, so the demo does not depend on remembering this file. Only accounts
  // whose screen differs from the others are listed; the rest are ordinary learners.
  console.log('\nWhat each account demonstrates:');
  const DEMO_ROLES = [
    [ADMIN.email, 'admin', 'Operations: verification queue, verifier queue, account locks, and the audit log'],
    [VERIFIERS[0].email, 'verifier', 'Two pending claims it owns (Japanese, IELTS) and no claimed work'],
    [VERIFIERS[1].email, 'verifier', 'Two claims it took (React, Python) plus the approvals it decided'],
    [VERIFIERS[2].email, 'verifier', 'The Guitar/Piano reviewer behind the rejected→approved history'],
    [VERIFIERS[3].email, 'verifier', 'Suspended verifier — stood down with no decisions attributed to it'],
    [VERIFIERS[4].email, 'verifier', 'Revoked verifier — the terminal state on /admin/verifiers'],
    [USERS[0].email, 'user', 'Teacher: IELTS and English approved, Japanese still in the queue'],
    [USERS[1].email, 'user', 'Teacher: React claim already taken by a verifier, Python and TypeScript approved'],
    [USERS[4].email, 'user', 'Teacher: Piano refused, then approved on resubmission (two versions)'],
    [USERS[5].email, 'user', 'Teacher: Calculus approved at beginner, later superseded by expert'],
    [USERS[6].email, 'user', 'Student verification pending — the admin queue has something to decide'],
    [USERS[7].email, 'user', 'Student verification rejected — the reason shows on /verification'],
    [USERS[8].email, 'user', 'Student verification approved and then revoked'],
    [USERS[9].email, 'user', 'Suspended account — on the operations lock list; login is refused'],
  ];
  for (const [email, role, what] of DEMO_ROLES) {
    console.log(`  ${role.padEnd(8)} ${email.padEnd(38)} ${what}`);
  }

  console.log('\nKnown limits of this dataset:');
  console.log('  - documents open only after `--upload-documents` with real CLOUDINARY_* credentials;');
  console.log('    without them the signed URL is valid but the object does not exist (404).');
  console.log('  - FR-014 (teacher withdrawal) is deferred, so `withdrawal_outcome` is not seeded:');
  console.log('    the type has no producer in this release.');
  console.log('  - push devices are seeded inactive; the delivery history is fixture data, not sends.');
} finally {
  for (const module of MODULES) {
    if (sources[module].isInitialized) await sources[module].destroy();
  }
}
