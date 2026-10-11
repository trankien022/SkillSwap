import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * One-command demo bootstrap:
 *
 *   pnpm db:demo            # postgres+rabbitmq up, build, migrate, seed demo data
 *   pnpm db:demo -- --reset # same (the seed always starts from a clean slate)
 *
 * Requires Docker running. Reads credentials from the repo-root `.env`.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PG_CONTAINER = 'skillswap-postgres';
const extraArgs = process.argv.slice(2);

function run(command, args, options = {}) {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  // One command string through the shell so Windows resolves the pnpm/docker
  // .cmd shims without the args-array deprecation warning.
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
run('docker', ['compose', 'up', '-d']);
waitForPostgres();
run('pnpm', ['build']);
run('node', ['scripts/migrate.mjs']);
run('node', ['scripts/seed-demo.mjs', ...extraArgs]);

console.log('\nDemo environment ready.');
