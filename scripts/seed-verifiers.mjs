import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * FR-004 / ADR-027: seed a Verifier account and its expertise (operator-provisioned;
 * there is no admin API for this). Also seeds skills if needed.
 *
 * Usage:
 *   node scripts/seed-verifiers.mjs --account <accountId> --skills <skillId,skillId...>
 *   node scripts/seed-verifiers.mjs --skill "IELTS|Languages"
 *
 * Verifier accounts must exist already (this records the verifier row + expertise,
 * it does not create the account). Reads credentials from the repo-root `.env`.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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
    else if (key === '--skills') args.skills = String(value ?? '').split(',').filter(Boolean);
    else if (key === '--skill') args.seed.push(value);
    else if (key === '--status') args.status = value;
  }
  return args;
}

loadRootEnv();
const { ApiConfig } = await import(
  pathToFileURL(join(ROOT, 'apps', 'api', 'dist', 'shared', 'config', 'api-config.js')).href
);
const { createModuleDataSource } = await import(
  pathToFileURL(
    join(ROOT, 'apps', 'api', 'dist', 'modules', 'skill-verification', 'internal', 'adapter', 'out', 'persistence', 'data-source.js'),
  ).href
);

const args = parseArgs(process.argv.slice(2));
const config = new ApiConfig();
const dataSource = createModuleDataSource(config);
await dataSource.initialize();

try {
  for (const spec of args.seed) {
    const [name, category] = spec.split('|');
    if (!name || !category) {
      console.warn(`Skipping malformed --skill "${spec}" (expected "name|category")`);
      continue;
    }
    const rows = await dataSource.query(
      `INSERT INTO "skill_verification"."skills" ("name", "category") VALUES ($1, $2)
         ON CONFLICT ("name", "category") DO UPDATE SET "updated_at" = now()
         RETURNING "id"`,
      [name, category],
    );
    console.log(`skill ${name} (${category}) -> ${rows[0].id}`);
  }

  if (args.account) {
    await dataSource.query(
      `INSERT INTO "skill_verification"."verifiers" ("account_id", "status") VALUES ($1, $2)
         ON CONFLICT ("account_id") DO UPDATE SET "status" = EXCLUDED."status", "updated_at" = now()`,
      [args.account, args.status ?? 'active'],
    );
    for (const skillId of args.skills) {
      await dataSource.query(
        `INSERT INTO "skill_verification"."verifier_expertise" ("account_id", "skill_id") VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
        [args.account, skillId],
      );
    }
    console.log(`verifier ${args.account} -> ${args.skills.length} skill(s)`);
  }
} finally {
  if (dataSource.isInitialized) await dataSource.destroy();
}
