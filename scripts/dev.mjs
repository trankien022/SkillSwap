import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Starts the dev stack and the ngrok tunnel together (`pnpm dev`).
 *
 * This replaces the previous one-liner:
 *
 *   pnpm run dev:ngrok & pnpm -r --parallel dev
 *
 * which reads as "run both in parallel" but does not. npm scripts on Windows go
 * through `cmd.exe`, where a lone `&` is a *sequential* separator — the
 * parallel/backgrounding operator is PowerShell's, not cmd's. So `pnpm dev`
 * started ngrok, waited for a process that never exits, and only began starting
 * the apps once ngrok was cancelled by hand.
 *
 * Both children are spawned here as real siblings instead, so they genuinely
 * overlap and a single Ctrl-C takes down both.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IS_WINDOWS = process.platform === 'win32';

/**
 * pnpm is a `.cmd` shim on Windows. Passing `shell: true` lets Node resolve it,
 * but Node then escapes nothing and warns (DEP0190) about that — so the shim is
 * invoked through `cmd /c` explicitly and every argument is quoted here.
 */
function spawnPnpm(args, label) {
  const command = IS_WINDOWS ? 'cmd' : 'pnpm';
  const commandArgs = IS_WINDOWS
    ? ['/c', 'pnpm', ...args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg))]
    : args;

  const child = spawn(command, commandArgs, { cwd: ROOT, stdio: 'inherit' });
  child.on('error', (error) => {
    console.log(`[dev] ${label} could not start: ${error.message}`);
  });
  return child;
}

const ngrok = spawnPnpm(['run', 'dev:ngrok'], 'ngrok');
const stack = spawnPnpm(['-r', '--parallel', 'dev'], 'stack');

let shuttingDown = false;

/** Stops both children once, then exits with `code`. */
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of [stack, ngrok]) {
    if (child.exitCode === null && child.signalCode === null) {
      // `taskkill /T` is not needed: the stack's own watchers are cleaned up by
      // `pnpm dev:stop`, and killing these roots stops the supervisor loop that
      // would otherwise respawn them.
      child.kill();
    }
  }

  // Give the children a moment to unwind before the parent goes, so their last
  // log lines are not lost mid-write.
  setTimeout(() => process.exit(code), 500);
}

// The stack is what the developer actually asked for, so its exit decides the
// parent's status. ngrok exiting is reported, never fatal — `dev-ngrok.mjs` is
// deliberately forgiving (it exits 0 when the token is absent or the endpoint
// is already online), and payment IPN testing must not be a prerequisite for
// running the rest of the stack.
stack.on('exit', (code) => shutdown(code ?? 0));
ngrok.on('exit', (code) => {
  if (code !== 0 && !shuttingDown) {
    console.log(`[dev] ngrok exited with code ${code}; the stack keeps running.`);
  }
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => shutdown(0));
}
