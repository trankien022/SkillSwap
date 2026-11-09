import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * One-command demo bootstrap:
 *
 *   pnpm db:demo            # local: postgres+rabbitmq up, build, migrate, seed demo data
 *   pnpm db:demo -- --reset # same (the seed always converges from a clean demo slate)
 *   pnpm db:demo -- --allow-remote  # skip Docker, seed the configured managed database
 *
 * Reads credentials from the repo-root `.env`.
 *
 * **The container started here is not necessarily the database that gets seeded.** `migrate.mjs`
 * and `seed-demo.mjs` both read the root `.env`, so when `DATABASE_HOST` names a managed
 * instance the Docker step is dead weight and the data lands remotely. This script therefore
 * only starts Docker when the configured host is local, and the seed refuses a remote host
 * unless `--allow-remote` is passed.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PG_CONTAINER = 'skillswap-postgres';
const extraArgs = process.argv.slice(2);

/** Hosts that mean "the container this script starts". */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'host.docker.internal']);

function run(command, args, options = {}) {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  // One command string through the shell so Windows resolves the pnpm/docker .cmd shims
  // without the args-array deprecation warning.
  const line = [command, ...args].join(' ');
  const result = spawnSync(line, { cwd: ROOT, stdio: 'inherit', shell: true, ...options });
  if (result.status !== 0) {
    throw new Error(`${line} exited with ${result.status}`);
  }
}

function ensureEnv() {
  if (!existsSync(join(ROOT, '.env'))) {
    throw new Error('Missing .env — copy .env.example to .env first.');
  }
}

/** Reads DATABASE_HOST from the root `.env` without importing the API config. */
function databaseHost() {
  if (process.env.DATABASE_HOST) return process.env.DATABASE_HOST.trim();
  for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?DATABASE_HOST\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    let value = match[1];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '').trim();
    }
    if (value !== '') return value;
  }
  return 'localhost';
}

/** Waits until postgres accepts connections (up to 60s). */
function waitForPostgres() {
  process.stdout.write('\nwaiting for postgres');
  for (let i = 0; i < 60; i += 1) {
    const probe = spawnSync(`docker exec ${PG_CONTAINER} pg_isready -U postgres`, {
      stdio: 'ignore',
      shell: true,
    });
    if (probe.status === 0) {
      process.stdout.write(' ready\n');
      return;
    }
    process.stdout.write('.');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  throw new Error('postgres did not become ready within 60s');
}

ensureEnv();
const host = databaseHost();
const local = LOCAL_HOSTS.has(host);

if (local) {
  run('docker', ['compose', 'up', '-d']);
  waitForPostgres();
} else {
  console.log(`\n${host} is not a local host: skipping Docker (the seed targets the configured database).`);
  if (!extraArgs.includes('--allow-remote')) {
    throw new Error(
      `DATABASE_HOST is "${host}", which is remote. Re-run as:\n\n` +
        '  pnpm db:demo -- --allow-remote\n\n' +
        'or run --check first to see what is already there:\n\n' +
        '  node scripts/seed-demo.mjs --check',
    );
  }
}

run('pnpm', ['build']);
run('node', ['scripts/migrate.mjs']);
run('node', ['scripts/seed-demo.mjs', ...extraArgs]);

console.log('\nDemo environment ready.');
