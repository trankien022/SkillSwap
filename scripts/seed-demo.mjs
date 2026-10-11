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

async function resetDemo(accountDs) {
  // Scoped deletes: only the fixed demo emails. Cascades clear credentials/sessions.
  await accountDs.query(
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

// ── Main ───────────────────────────────────────────────────────────────────
const accountDs = await loadDataSource('account-profile');
const skillDs = await loadDataSource('skill-verification');
const ids = {};

try {
  if (RESET) {
    await resetDemo(accountDs);
    console.log('reset: removed previous demo accounts');
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

  console.log('\nDemo credentials (password for every account: ' + DEMO_PASSWORD + ')');
  console.log(`  admin     ${ADMIN.email}`);
  for (const v of VERIFIERS) console.log(`  verifier  ${v.email}`);
  console.log(`  user      ${USERS[0].email} … ${USERS[USERS.length - 1].email}`);
} finally {
  if (skillDs.isInitialized) await skillDs.destroy();
  if (accountDs.isInitialized) await accountDs.destroy();
}
