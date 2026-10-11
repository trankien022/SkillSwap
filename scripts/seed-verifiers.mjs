import { existsSync, readFileSync } from 'node:fs';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * FR-004 / ADR-027 / ADR-029: provision a Verifier — an **account** with role
 * `verifier` (operator-provisioned; no admin API, ADR-029 §3) plus the seeded
 * expertise that scopes its review queue. Also seeds skills on demand.
 *
 * Usage:
 *   node scripts/seed-verifiers.mjs --email v@x.io --name "Verifier" --password secret123 \
 *        --skills <skillId,skillId...> [--status active]
 *   node scripts/seed-verifiers.mjs --skill "IELTS|Languages"     # seed a skill only
 *   node scripts/seed-verifiers.mjs --account <accountId> --skills <ids...>   # expertise for an existing account
 *
 * Reads credentials from the repo-root `.env`. Requires `pnpm build` first.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

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

function parseArgs(argv) {
  const args = { skills: [], seed: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--account') args.account = value;
    else if (key === '--email') args.email = value;
    else if (key === '--name') args.name = value;
    else if (key === '--password') args.password = value;
    else if (key === '--skills') args.skills = String(value ?? '').split(',').filter(Boolean);
    else if (key === '--skill') args.seed.push(value);
    else if (key === '--status') args.status = value;
  }
  return args;
}

async function hashPassword(plaintext) {
  const salt = randomBytes(16).toString('base64');
  const derived = await scryptAsync(plaintext, salt, KEY_LENGTH);
  return { salt, hash: derived.toString('base64') };
}

loadRootEnv();
const { ApiConfig } = await import(
  pathToFileURL(join(ROOT, 'apps', 'api', 'dist', 'shared', 'config', 'api-config.js')).href
);
async function loadDataSource(module) {
  const { createModuleDataSource } = await import(
    pathToFileURL(
      join(
        ROOT, 'apps', 'api', 'dist', 'modules', module, 'internal', 'adapter', 'out', 'persistence', 'data-source.js',
      ),
    ).href
  );
  const ds = createModuleDataSource(new ApiConfig());
  await ds.initialize();
  return ds;
}

const args = parseArgs(process.argv.slice(2));
const skillDs = await loadDataSource('skill-verification');

try {
  for (const spec of args.seed) {
    const [name, category] = spec.split('|');
    if (!name || !category) {
      console.warn(`Skipping malformed --skill "${spec}" (expected "name|category")`);
      continue;
    }
    const rows = await skillDs.query(
      `INSERT INTO "skill_verification"."skills" ("name", "category") VALUES ($1, $2)
         ON CONFLICT ("name", "category") DO UPDATE SET "updated_at" = now()
         RETURNING "id"`,
      [name, category],
    );
    console.log(`skill ${name} (${category}) -> ${rows[0].id}`);
  }

  let accountId = args.account;

  // Provision the account (role=verifier) when an email + password are given.
  if (!accountId && args.email) {
    if (!args.password) {
      throw new Error('--password is required when provisioning a new verifier account');
    }
    const accountDs = await loadDataSource('account-profile');
    try {
      const { salt, hash } = await hashPassword(args.password);
      const existing = await accountDs.query(
        `SELECT "id" FROM "account_profile"."accounts" WHERE lower("email") = lower($1) LIMIT 1`,
        [args.email],
      );
      let id = existing[0]?.id;
      if (id) {
        await accountDs.query(
          `UPDATE "account_profile"."accounts" SET "role" = 'verifier', "updated_at" = now()
             WHERE "id" = $1`,
          [id],
        );
        console.warn(`account ${args.email} already existed — role set to verifier`);
      } else {
        const rows = await accountDs.query(
          `INSERT INTO "account_profile"."accounts" ("email", "display_name", "role", "status")
           VALUES (lower($1), $2, 'verifier', 'active')
           RETURNING "id"`,
          [args.email, args.name ?? 'Verifier'],
        );
        id = rows[0].id;
      }
      accountId = id;
      await accountDs.query(
        `INSERT INTO "account_profile"."account_credentials"
           ("account_id", "algorithm", "salt", "hash", "key_length", "updated_at")
         VALUES ($1, 'scrypt', $2, $3, $4, now())
         ON CONFLICT ("account_id") DO UPDATE
           SET "algorithm" = EXCLUDED."algorithm", "salt" = EXCLUDED."salt",
               "hash" = EXCLUDED."hash", "key_length" = EXCLUDED."key_length", "updated_at" = now()`,
        [id, salt, hash, KEY_LENGTH],
      );
      console.log(`verifier account ${args.email} -> ${id}`);
    } finally {
      if (accountDs.isInitialized) await accountDs.destroy();
    }
  }

  if (accountId) {
    await skillDs.query(
      `INSERT INTO "skill_verification"."verifiers" ("account_id", "status") VALUES ($1, $2)
         ON CONFLICT ("account_id") DO UPDATE SET "status" = EXCLUDED."status", "updated_at" = now()`,
      [accountId, args.status ?? 'active'],
    );
    for (const skillId of args.skills) {
      await skillDs.query(
        `INSERT INTO "skill_verification"."verifier_expertise" ("account_id", "skill_id") VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
        [accountId, skillId],
      );
    }
    console.log(`verifier ${accountId} -> ${args.skills.length} skill(s)`);
  } else if (!args.seed.length) {
    console.warn('Nothing to do: pass --email/--password to provision a verifier, or --account for expertise.');
  }
} finally {
  if (skillDs.isInitialized) await skillDs.destroy();
}
