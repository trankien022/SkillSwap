import { existsSync, readFileSync } from 'node:fs';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Demo seed for the whole current schema. Idempotent: safe to re-run.
 *
 *   node scripts/seed-demo.mjs [--reset]
 *
 * --reset deletes the demo rows (scoped to the fixed demo emails / skill names)
 * before re-inserting, so ids and timestamps are regenerated.
 *
 * Writes each table through its owning module's data source (ADR-007), reading
 * credentials from the repo-root `.env`. Requires `pnpm build` first.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** Shared password for every demo account — printed at the end. */
const DEMO_PASSWORD = 'Demo1234!';
const DEMO_DOMAIN = 'demo.skillswap.local';

const RESET = process.argv.slice(2).includes('--reset');

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
async function loadDataSource(module, schema) {
  const file = join(
    ROOT, 'apps', 'api', 'dist', 'modules', module, 'internal', 'adapter', 'out', 'persistence', 'data-source.js',
  );
  if (!existsSync(file)) {
    throw new Error(`Missing ${file} — run \`pnpm build\` first.`);
  }
  const mod = await import(pathToFileURL(file).href);
  const ds = mod.createModuleDataSource(config, schema);
  await ds.initialize();
  return ds;
}

// ── Demo identities ────────────────────────────────────────────────────────
// 1 admin, 3 verifiers, 10 users. Deterministic emails so re-runs converge.
const ADMIN = { email: `admin@${DEMO_DOMAIN}`, displayName: 'Demo Admin', role: 'admin' };
const VERIFIERS = [
  { email: `verifier1@${DEMO_DOMAIN}`, displayName: 'Verifier An', role: 'verifier', expertise: ['IELTS', 'Japanese'] },
  { email: `verifier2@${DEMO_DOMAIN}`, displayName: 'Verifier Binh', role: 'verifier', expertise: ['Python', 'React'] },
  { email: `verifier3@${DEMO_DOMAIN}`, displayName: 'Verifier Chi', role: 'verifier', expertise: ['Guitar', 'Piano'] },
];
const USERS = Array.from({ length: 10 }, (_, i) => ({
  email: `user${i + 1}@${DEMO_DOMAIN}`,
  displayName: `Demo User ${i + 1}`,
  role: 'user',
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

async function upsertAccount(ds, identity) {
  const existing = await ds.query(
    `SELECT "id" FROM "account_profile"."accounts" WHERE lower("email") = lower($1) LIMIT 1`,
    [identity.email],
  );
  let id = existing[0]?.id;
  if (id) {
    await ds.query(
      `UPDATE "account_profile"."accounts"
         SET "display_name" = $2, "role" = $3, "status" = 'active', "updated_at" = now()
       WHERE "id" = $1`,
      [id, identity.displayName, identity.role],
    );
  } else {
    const rows = await ds.query(
      `INSERT INTO "account_profile"."accounts" ("email", "display_name", "role", "status")
       VALUES (lower($1), $2, $3, 'active') RETURNING "id"`,
      [identity.email, identity.displayName, identity.role],
    );
    id = rows[0].id;
  }

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

async function resetDemo(ctx) {
  // Scoped deletes over the demo-owned rows. Accounts cascade to credentials and
  // sessions; evidence/audit cascade from profile_skills; the rest are keyed by
  // the demo account ids.
  await ctx.classDs.query(`DELETE FROM "live_class"."bookings"`);
  await ctx.classDs.query(`DELETE FROM "live_class"."classes"`);
  await ctx.classDs.query(`DELETE FROM "live_class"."teacher_skill_approval"`);
  await ctx.classDs.query(`DELETE FROM "live_class"."teacher_verified"`);
  await ctx.studentDs.query(`DELETE FROM "student_verification"."verification_documents"`);
  await ctx.studentDs.query(`DELETE FROM "student_verification"."student_verifications"`);
  await ctx.walletDs.query(`DELETE FROM "wallet_ledger"."ledger_entries"`);
  await ctx.walletDs.query(`DELETE FROM "wallet_ledger"."top_up_intents"`);
  await ctx.walletDs.query(`DELETE FROM "wallet_ledger"."wallets"`);
  await ctx.skillDs.query(`DELETE FROM "skill_verification"."skill_evidence_audit"`);
  await ctx.skillDs.query(`DELETE FROM "skill_verification"."skill_evidence"`);
  await ctx.skillDs.query(`DELETE FROM "skill_verification"."profile_skills"`);
  await ctx.skillDs.query(`DELETE FROM "skill_verification"."verifier_expertise"`);
  await ctx.skillDs.query(`DELETE FROM "skill_verification"."verifiers"`);
  await ctx.skillDs.query(`DELETE FROM "skill_verification"."verified_students"`);
  await ctx.skillDs.query(`DELETE FROM "skill_verification"."skills"`);
  await ctx.accountDs.query(`DELETE FROM "account_profile"."account_verification_status"`);
  await ctx.accountDs.query(
    `DELETE FROM "account_profile"."accounts" WHERE lower("email") LIKE $1`,
    [`%@${DEMO_DOMAIN}`],
  );
}

/** Upserts a taxonomy skill and returns its id (natural key: name + category). */
async function upsertSkill(ds, { name, category }) {
  const rows = await ds.query(
    `INSERT INTO "skill_verification"."skills" ("name", "category")
     VALUES ($1, $2)
     ON CONFLICT ("name", "category") DO UPDATE SET "updated_at" = now()
     RETURNING "id"`,
    [name, category],
  );
  return rows[0].id;
}

/** Creates/refreshes a verifier row and its expertise set; returns nothing. */
async function upsertVerifier(ds, accountId, skillIds, status = 'active') {
  await ds.query(
    `INSERT INTO "skill_verification"."verifiers" ("account_id", "status")
     VALUES ($1, $2)
     ON CONFLICT ("account_id") DO UPDATE SET "status" = EXCLUDED."status", "updated_at" = now()`,
    [accountId, status],
  );
  await ds.query(`DELETE FROM "skill_verification"."verifier_expertise" WHERE "account_id" = $1`, [
    accountId,
  ]);
  for (const skillId of skillIds) {
    await ds.query(
      `INSERT INTO "skill_verification"."verifier_expertise" ("account_id", "skill_id")
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [accountId, skillId],
    );
  }
}

// ── FR-002: student verification + its four projections ────────────────────
/**
 * Upserts one student verification and fans it out into the read projections,
 * mirroring the event flow (ADR-024): account-profile status, skill-verification
 * verified_students, live-class teacher_verified.
 */
async function upsertStudentVerification(ctx, { accountId, schoolName, major, status, reviewerId, reason }) {
  const decidedAt = status === 'pending' ? null : new Date();
  const rows = await ctx.studentDs.query(
    `INSERT INTO "student_verification"."student_verifications"
       ("account_id", "school_name", "major", "document_ref", "status", "reviewer_id", "reason", "decided_at")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING "id"`,
    [accountId, schoolName, major ?? null, `demo/${accountId}.pdf`, status, reviewerId ?? null, reason ?? null, decidedAt],
  );
  const verificationId = rows[0].id;

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
    `INSERT INTO "live_class"."teacher_verified" ("account_id", "verified", "occurred_at", "updated_at")
     VALUES ($1, $2, $3, now())
     ON CONFLICT ("account_id") DO UPDATE
       SET "verified" = EXCLUDED."verified", "occurred_at" = EXCLUDED."occurred_at", "updated_at" = now()`,
    [accountId, status === 'approved', occurredAt],
  );
  return verificationId;
}

/** Upserts a profile skill (owner + skill) and returns its id. */
async function upsertProfileSkill(ds, accountId, skillId) {
  const rows = await ds.query(
    `INSERT INTO "skill_verification"."profile_skills" ("account_id", "skill_id")
     VALUES ($1, $2)
     ON CONFLICT ("account_id", "skill_id") DO UPDATE SET "updated_at" = now()
     RETURNING "id"`,
    [accountId, skillId],
  );
  return rows[0].id;
}

/**
 * Writes an evidence version plus its audit trail (FR-003/FR-018/ADR-028) and,
 * when approved, mirrors the effective level into profile_skills and the
 * live-class teacher_skill_approval projection.
 */
async function upsertEvidence(ctx, { profileSkillId, accountId, skillId, version, status, requestedLevel, approvedLevel, evidenceType, description, claimedBy, reviewerId }) {
  const decidedAt = ['approved', 'rejected'].includes(status) ? new Date() : null;
  const claimedAt = claimedBy ? new Date() : null;
  const rows = await ctx.skillDs.query(
    `INSERT INTO "skill_verification"."skill_evidence"
       ("profile_skill_id", "evidence_type", "document_ref", "description", "version",
        "requested_level", "approved_level", "status", "claimed_by", "claimed_at",
        "reviewer_id", "reason", "decided_at")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING "id"`,
    [
      profileSkillId, evidenceType, null, description, version,
      requestedLevel, approvedLevel ?? null, status, claimedBy ?? null, claimedAt,
      reviewerId ?? null, status === 'rejected' ? 'Insufficient evidence' : null, decidedAt,
    ],
  );
  const evidenceId = rows[0].id;

  const snapshot = {
    version,
    status,
    evidenceType,
    requestedLevel,
    approvedLevel: approvedLevel ?? null,
    reason: status === 'rejected' ? 'Insufficient evidence' : null,
  };
  const toStatus = status === 'pending' ? 'pending' : status;
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
      [evidenceId, profileSkillId, version, action, claimedBy ?? reviewerId ?? accountId, toStatus, snapshot.reason, JSON.stringify(snapshot)],
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

// ── Main ───────────────────────────────────────────────────────────────────
const accountDs = await loadDataSource('account-profile');
const skillDs = await loadDataSource('skill-verification');
const studentDs = await loadDataSource('student-verification');
const classDs = await loadDataSource('live-class');
const walletDs = await loadDataSource('wallet-ledger');
const ctx = { accountDs, skillDs, studentDs, classDs, walletDs };
const ids = {};

try {
  if (RESET) {
    await resetDemo(ctx);
    console.log('reset: removed previous demo rows');
  }

  for (const identity of ALL_IDENTITIES) {
    ids[identity.email] = await upsertAccount(accountDs, identity);
  }
  console.log(`accounts: ${ALL_IDENTITIES.length} (1 admin, ${VERIFIERS.length} verifier, ${USERS.length} user)`);

  const skillIdByName = {};
  for (const skill of SKILLS) {
    skillIdByName[skill.name] = await upsertSkill(skillDs, skill);
  }
  console.log(`skills: ${SKILLS.length}`);

  for (const verifier of VERIFIERS) {
    const accountId = ids[verifier.email];
    const skillIds = verifier.expertise.map((name) => {
      const id = skillIdByName[name];
      if (id === undefined) throw new Error(`Verifier ${verifier.email} references unknown skill "${name}"`);
      return id;
    });
    await upsertVerifier(skillDs, accountId, skillIds);
  }
  console.log(`verifiers: ${VERIFIERS.length} with expertise`);

  // FR-002: verifications across every status. The first six users are approved
  // students (candidate teachers); one pending and one rejected for the admin queue.
  const adminId = ids[ADMIN.email];
  const verifier1Id = ids[VERIFIERS[0].email];
  const USER_STATUS = [
    'approved', 'approved', 'approved', 'approved', 'approved', 'approved',
    'pending', 'rejected', 'approved', 'pending',
  ];
  const userIdByIndex = USERS.map((u) => ids[u.email]);
  for (let i = 0; i < USERS.length; i += 1) {
    const status = USER_STATUS[i];
    await upsertStudentVerification(ctx, {
      accountId: userIdByIndex[i],
      schoolName: `Demo University ${1 + (i % 3)}`,
      major: ['Computer Science', 'Business', 'Languages'][i % 3],
      status,
      reviewerId: status === 'pending' ? undefined : adminId,
      reason: status === 'rejected' ? 'Document could not be verified' : undefined,
    });
  }
  console.log(`student verifications: ${USERS.length}`);

  // FR-003: approved skills for the teachers (users 1–6). Each teacher gets 1–2
  // approved skills at a level, so the publish gate is satisfied.
  const TEACHING = [
    { user: 0, skills: ['IELTS', 'English Conversation'] },
    { user: 1, skills: ['Python', 'TypeScript'] },
    { user: 2, skills: ['React', 'TypeScript'] },
    { user: 3, skills: ['Japanese'] },
    { user: 4, skills: ['Guitar', 'Piano'] },
    { user: 5, skills: ['Calculus'] },
  ];
  const LEVELS = ['intermediate', 'advanced', 'expert'];
  for (const t of TEACHING) {
    const accountId = userIdByIndex[t.user];
    for (let s = 0; s < t.skills.length; s += 1) {
      const skillName = t.skills[s];
      const skillId = skillIdByName[skillName];
      const level = LEVELS[(t.user + s) % LEVELS.length];
      const profileSkillId = await upsertProfileSkill(skillDs, accountId, skillId);
      await upsertEvidence(ctx, {
        profileSkillId, accountId, skillId, version: 1, status: 'approved',
        requestedLevel: level, approvedLevel: level,
        evidenceType: 'certificate', description: `Demo certificate for ${skillName}`,
        reviewerId: verifier1Id,
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
    const profileSkillId = await upsertProfileSkill(skillDs, accountId, skillId);
    await upsertEvidence(ctx, {
      profileSkillId, accountId, skillId, version: 1, status: q.status,
      requestedLevel: 'intermediate', approvedLevel: null,
      evidenceType: 'verifier_assessment', description: `Demo evidence for ${q.skillName}`,
      claimedBy: q.claimedBy, reviewerId: q.reviewerId,
    });
  }
  console.log('skill evidence: 6 teachers approved, 3 in the verifier queue');

  console.log('\nDemo credentials (password for every account: ' + DEMO_PASSWORD + ')');
  console.log(`  admin     ${ADMIN.email}`);
  for (const v of VERIFIERS) console.log(`  verifier  ${v.email}`);
  console.log(`  user      ${USERS[0].email} … ${USERS[USERS.length - 1].email}`);
} finally {
  if (walletDs.isInitialized) await walletDs.destroy();
  if (classDs.isInitialized) await classDs.destroy();
  if (studentDs.isInitialized) await studentDs.destroy();
  if (skillDs.isInitialized) await skillDs.destroy();
  if (accountDs.isInitialized) await accountDs.destroy();
}
