import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Creates the seven roles and seven schemas an API deployment needs (ADR-007).
 *
 * `docker/postgres/init/*.sql` only run on a container's *first* boot, so a managed Postgres
 * (Neon, Aiven, …) never gets them. Without this, the API connects successfully and then fails
 * every migration with `schema "wallet_ledger" does not exist`.
 *
 * Deliberately separate from `migrate.mjs`: this needs an **admin** credential, while migrations
 * need the **per-module** credentials, and a deployment should not keep admin rights around for
 * the lifetime of the app.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMAS = [
  'admin_operation',
  'student_verification',
  'skill_verification',
  'account_profile',
  'live_class',
  'wallet_ledger',
  'schedule',
];

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

/** SQL identifiers cannot be parameterised, so every one of them is checked against this. */
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function identifier(value) {
  if (!SAFE_IDENTIFIER.test(value)) {
    throw new Error(`Refusing to interpolate unsafe SQL identifier: ${JSON.stringify(value)}`);
  }
  return `"${value}"`;
}

function literal(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Same rule as `ApiConfig.databaseCredentials`: DATABASE_<SCHEMA>_USER/_PASSWORD. */
function credentials(config, schema) {
  const creds = config.databaseCredentials(schema);
  const user = process.env[`DATABASE_${schema.toUpperCase()}_USER`] ?? creds.user;
  const password = process.env[`DATABASE_${schema.toUpperCase()}_PASSWORD`] ?? creds.password;
  return { user, password };
}

loadRootEnv();

const { ApiConfig } = await import(
  pathToFileURL(join(ROOT, 'apps', 'api', 'dist', 'shared', 'config', 'api-config.js')).href
).catch(() => {
  throw new Error('Missing apps/api/dist — run `pnpm build` first.');
});
const config = new ApiConfig();

const adminUser = process.env.DATABASE_ADMIN_USER;
const adminPassword = process.env.DATABASE_ADMIN_PASSWORD ?? process.env.DATABASE_PASSWORD;
if (!adminUser) {
  console.error(
    'DATABASE_ADMIN_USER is not set.\n' +
      'Bootstrap needs a role that may CREATE ROLE and CREATE SCHEMA — on Neon that is\n' +
      '`neondb_owner`, not any of the seven module roles.',
  );
  process.exitCode = 1;
  process.exit();
}
// A managed host is reachable from the internet; an empty password there is a worse outcome
// than a refused bootstrap, so this is a hard stop rather than a warning.
if (!adminPassword) {
  console.error('DATABASE_ADMIN_PASSWORD is not set; refusing to bootstrap with a blank password.');
  process.exitCode = 1;
  process.exit();
}
for (const schema of SCHEMAS) {
  const { password } = credentials(config, schema);
  if (!password) {
    console.error(`DATABASE_${schema.toUpperCase()}_PASSWORD resolved to an empty string.`);
    process.exitCode = 1;
    process.exit();
  }
}

const { default: pg } = await import('pg');
const client = new pg.Client({
  host: config.databaseHost,
  port: config.databasePort,
  database: config.databaseName,
  user: adminUser,
  password: adminPassword,
  ssl: config.databaseSsl ? { rejectUnauthorized: config.databaseSslVerify } : undefined,
});

await client.connect();

try {
  // Checked up front: on a pooler this fails with `unsupported startup parameter in options`,
  // and saying so here is far clearer than the same error surfacing from a migration run.
  const [{ current_user: currentUser }] = (await client.query('SELECT current_user')).rows;
  console.log(`bootstrap: connected as ${currentUser} to ${config.databaseHost}`);

  await client.query('BEGIN');
  for (const schema of SCHEMAS) {
    const { user, password } = credentials(config, schema);
    const role = identifier(user);
    const sch = identifier(schema);

    const roleExists = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [user]);
    if (roleExists.rowCount === 0) {
      await client.query(`CREATE ROLE ${role} LOGIN PASSWORD ${literal(password)}`);
      console.log(`  ${schema}: created role ${user}`);
    } else {
      // Rotation: an existing deployment may have changed the password in its secrets.
      await client.query(`ALTER ROLE ${role} WITH LOGIN PASSWORD ${literal(password)}`);
      console.log(`  ${schema}: role ${user} exists`);
    }

    // `CREATE SCHEMA ... AUTHORIZATION <role>` requires the creator to be able to SET ROLE into
    // that role. A managed owner is CREATEROLE but not superuser, so without this grant the
    // statement fails with `must be able to SET ROLE "skillswap_..."`.
    await client.query(`GRANT ${role} TO ${identifier(currentUser)}`);

    const schemaExists = await client.query('SELECT 1 FROM pg_namespace WHERE nspname = $1', [
      schema,
    ]);
    if (schemaExists.rowCount === 0) {
      await client.query(`CREATE SCHEMA ${sch} AUTHORIZATION ${role}`);
      console.log(`  ${schema}: created schema, owned by ${user}`);
    } else {
      const [{ owner }] = (
        await client.query(
          'SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname = $1',
          [schema],
        )
      ).rows;
      console.log(`  ${schema}: schema exists, owned by ${owner}`);
    }

    // Isolation (ADR-007): the module user reaches its own schema and nothing else. The PUBLIC
    // revoke must come *before* the membership revoke below — after it, the operator no longer
    // has the ownership rights needed to change grants on this schema.
    await client.query(`REVOKE ALL ON SCHEMA ${sch} FROM PUBLIC`);
    await client.query(`REVOKE ${role} FROM ${identifier(currentUser)}`);
  }
  await client.query('COMMIT');
  console.log(`bootstrap ok — ${SCHEMAS.length} role(s) and schema(s)`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`bootstrap FAILED — ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
