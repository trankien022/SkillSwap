import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Starts the SkillSwap ngrok tunnel alongside `pnpm dev` (FR-008 / ADR-033).
 *
 * The API exposes the SePay IPN at POST /api/wallet/top-ups/callback, and SePay
 * can only reach it through a public HTTPS URL. This script is the dev-stack
 * integration for `ngrok.yml`; `scripts/start-ngrok.ps1` is the manual entry
 * point for Windows developers.
 *
 * It is deliberately forgiving: `pnpm dev` must still start the rest of the
 * stack when ngrok or its token is absent, because only payment testing needs
 * the tunnel. A missing tunnel is reported, not fatal.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = resolve(ROOT, 'ngrok.yml');
const IS_WINDOWS = process.platform === 'win32';

/** Reads one KEY=value from `.env` without executing the file. */
function readEnvValue(name) {
  const envPath = resolve(ROOT, '.env');
  if (!existsSync(envPath)) return null;
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match === null || match[1] !== name) continue;
    let value = match[2].trim();
    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.slice(1, -1);
      }
    }
    return value === '' ? null : value;
  }
  return null;
}

/** Prints one actionable line and exits 0 so `pnpm dev` keeps running. */
function skip(message) {
  console.log(`[ngrok] ${message}`);
  console.log('[ngrok] tunnel not started — payment IPN testing will not work until it is.');
  process.exit(0);
}

/** Resolves the ngrok executable, preferring the real .exe over the .cmd shim. */
function resolveNgrok() {
  const names = IS_WINDOWS ? ['ngrok.exe', 'ngrok.cmd', 'ngrok.bat'] : ['ngrok'];
  for (const dir of (process.env.PATH ?? '').split(IS_WINDOWS ? ';' : ':')) {
    if (dir === '') continue;
    for (const name of names) {
      const candidate = resolve(dir, name);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

if (!existsSync(CONFIG)) {
  skip(`ngrok.yml not found at ${CONFIG}`);
}

const token = process.env.NGROK_AUTHTOKEN ?? readEnvValue('NGROK_AUTHTOKEN');
if (token === null || token.startsWith('replace-')) {
  skip('NGROK_AUTHTOKEN is not set in .env — see README "Payment tunnel (ngrok)".');
}

const executable = resolveNgrok();
if (executable === null) {
  skip('ngrok was not found on PATH — install ngrok Agent v3 (https://ngrok.com/download).');
}

// ngrok does not expand ${VAR} inside ngrok.yml — it passes the literal string
// through — so the token is supplied as a flag instead. It stays in this
// process's argv, is never echoed, and dies with the dev stack.
const args = ['start', 'api', '--config', CONFIG, '--authtoken', token];
const child = spawn(executable, args, { cwd: ROOT, stdio: 'inherit' });

child.on('error', (error) => {
  console.log(`[ngrok] could not start ngrok: ${error.message}`);
  process.exit(0);
});

child.on('exit', (code, signal) => {
  if (signal === null) {
    console.log(`[ngrok] tunnel exited with code ${code ?? 0}`);
  }
  process.exit(0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
