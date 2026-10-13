import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Stops every SkillSwap dev process, regardless of how many times it respawned.
 *
 *   pnpm dev:stop        # kill api/gateway/web/mobile dev trees, free their ports
 *   pnpm dev:stop -- -n  # dry run: only show what would be killed
 *
 * Why this exists: `nest start --watch`, `next dev` and Metro are supervisors.
 * They do not exit when the child crashes — they recompile and respawn a new
 * one, so killing the listener on :4000 just produces a fresh listener seconds
 * later. Killing a single PID therefore looks like "the process always comes
 * back". The only reliable stop is to kill every matching tree at once.
 *
 * Postgres and RabbitMQ are left alone (use `pnpm db:down` for those).
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IS_WINDOWS = process.platform === 'win32';

/** Ports the dev stack listens on. Nothing else should hold these. */
const PORTS = [3000, 3001, 3002, 4000, 4001, 4100, 8081, 8082];

/**
 * Entry points that identify a SkillSwap dev process. A match must be a real
 * dev-server entry point *and* run from this checkout.
 *
 * An allowlist rather than a search for "skillswap" in the command line: the
 * browser window opened at the localhost preview also has the repo path in its
 * command line, and `cmd.exe /c ... node scripts/dev-stop.mjs` is this very
 * process. Killing either would close the user's browser or the running shell.
 */
const ENTRY_POINTS = [
  // NestJS watchers for api and gateway
  /@nestjs[\\/]cli[\\/]bin[\\/]nest(\.js)?\b.*\bstart\b/,
  // Compiled api/gateway listeners (nest --watch respawns these)
  /apps[\\/](api|gateway)[\\/]dist[\\/]bootstrap[\\/]main/,
  // pnpm workspace wrappers: pnpm --filter @skillswap/<app> dev
  /pnpm(\.mjs|\.cjs)?\b.*--filter\s+@skillswap[\\/](api|gateway|web|mobile)\b/,
  // Next.js dev server
  /next(\.js)?\b.*\bdev\b/,
  // Expo / Metro
  /expo[\\/]bin[\\/]cli/,
  /[\\/]metro[\\/]/,
];

/**
 * Processes that mark the top of the sandbox. The ancestry walk stops here —
 * anything below the boundary is ours, anything at or above it is the harness.
 */
const ANCESTRY_BOUNDARY = [/opencode(\.exe)?\b/i, /zellij(\.exe)?\b/i, /^explorer/i];

function isBoundary(commandLine) {
  const cmd = commandLine ?? '';
  return ANCESTRY_BOUNDARY.some((pattern) => pattern.test(cmd));
}

/**
 * Shell/node processes that sit between a dev entry point and its root. They are
 * the glue of the tree (pnpm wrappers, `cmd /c ...` shims) rather than servers,
 * so they are only matched while walking up an already-identified tree.
 */
function looksLikeDevWrapper(commandLine) {
  const cmd = commandLine ?? '';
  if (!cmd) return false;
  const patterns = [
    /pnpm(\.mjs|\.cjs)?\b.*--filter\s+@skillswap/i,
    /cmd(\.exe)?\b.*(pnpm|nest|next|expo)\b/i,
    /cmd(\.exe)?\b.*skillswap/i,
  ];
  return patterns.some((pattern) => pattern.test(cmd));
}

/**
 * A process is ours only if its command line matches an entry point AND the run
 * comes from this checkout. The repo-path requirement is what excludes a
 * browser that merely happens to have the path in its argument list.
 */
function isSkillSwapProcess(commandLine) {
  const cmd = commandLine ?? '';
  if (!cmd) return false;

  const normalized = cmd.replace(/\\/g, '/').toLowerCase();
  const root = ROOT.replace(/\\/g, '/').toLowerCase();

  if (!ENTRY_POINTS.some((pattern) => pattern.test(cmd))) return false;

  // Must be running out of this repo — not a global pnpm, not a stray browser.
  return normalized.includes(root);
}

/** Lists { pid, ppid, cmd } for every process on the machine. */
function listProcesses() {
  if (IS_WINDOWS) {
    const script =
      'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ' +
      'ConvertTo-Csv -NoTypeInformation';
    let out = '';
    try {
      out = execFileSync('powershell', ['-NoProfile', '-Command', script], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch (error) {
      out = (error.stdout || '').toString();
    }
    const rows = [];
    for (const line of out.trim().split(/\r?\n/).slice(1)) {
      const match = line.match(/^"([^"]*)","([^"]*)","(.*)"$/);
      if (match) {
        const cmd = match[3].replace(/"/g, '');
        rows.push({
          pid: match[1],
          ppid: match[2],
          cmd,
          // First token of the command line is the image name on Windows.
          name: (cmd.split(/\s+/)[0] || '').split(/[\\/]/).pop() ?? '',
        });
      }
    }
    return rows;
  }

  // POSIX
  let out = '';
  try {
    out = execFileSync('ps', ['-eo', 'pid=,ppid=,args='], { encoding: 'utf8' });
  } catch (error) {
    out = (error.stdout || '').toString();
  }
  const rows = [];
  for (const line of out.split(/\r?\n/)) {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
    if (match) {
      rows.push({
        pid: match[1],
        ppid: match[2],
        cmd: match[3],
        name: (match[3].split(/\s+/)[0] || '').split('/').pop() ?? '',
      });
    }
  }
  return rows;
}

/** Maps each dev port to the PID listening on it. */
function portHolders() {
  const holders = new Map();
  const want = new Set(PORTS);
  const add = (pid, port) => {
    if (!holders.has(pid)) holders.set(pid, new Set());
    holders.get(pid).add(port);
  };
  try {
    if (IS_WINDOWS) {
      // IPv4 and IPv6 both listen, so the same port appears twice — a Set dedupes.
      const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8' });
      for (const line of out.split(/\r?\n/)) {
        const match = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)/);
        if (match && want.has(Number(match[1]))) add(match[2], Number(match[1]));
      }
    } else {
      const out = execFileSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], { encoding: 'utf8' });
      for (const line of out.split(/\r?\n/).slice(1)) {
        const parts = line.split(/\s+/);
        const pid = parts[1];
        const portMatch = (parts[8] || '').match(/:(\d+)$/);
        if (!pid || !portMatch || !want.has(Number(portMatch[1]))) continue;
        add(pid, Number(portMatch[1]));
      }
    }
  } catch (error) {
    // lsof/netstat missing is non-fatal — the marker scan still finds the trees.
    return { holders, error: error.message };
  }
  return { holders, error: null };
}

/** Collects the root PID of every matching tree plus every port holder. */
function findTargets() {
  const processes = listProcesses();
  const { holders, error } = portHolders();
  const byPid = new Map(processes.map((p) => [p.pid, p]));

  const roots = new Set();
  const depthOf = new Map();

  for (const proc of processes) {
    if (!isSkillSwapProcess(proc.cmd)) continue;

    // Walk up to the topmost process that is still inside our tree. Intermediate
    // processes do not have to match an entry point — the chain is
    //   cmd -> pnpm -> cmd -> nest -> cmd -> node
    // so stopping at the first non-match would wrongly promote `nest` to a root.
    // Instead, keep climbing until the harness boundary or a genuine dead end.
    let root = proc.pid;
    let cursor = proc;
    let depth = 0;
    for (let hop = 0; hop < 16; hop += 1) {
      const parent = byPid.get(cursor.ppid);
      if (!parent) break;
      if (isBoundary(parent.cmd)) break;
      // Anything above the repo checkout is not ours to kill.
      if (!isSkillSwapProcess(parent.cmd) && !looksLikeDevWrapper(parent.cmd)) break;
      root = parent.pid;
      cursor = parent;
      depth += 1;
    }
    roots.add(root);
    depthOf.set(root, Math.max(depthOf.get(root) ?? 0, depth));
  }

  // A listener whose tree we failed to identify may still block a dev port.
  // Only an obvious node process is treated as ours; anything else (a real
  // system service, a database, another app) is reported, never killed.
  const portOnly = [];
  const blockedPorts = [];
  for (const [pid, portSet] of holders) {
    const ports = [...portSet].sort((a, b) => a - b);
    const proc = byPid.get(pid);
    const isNode =
      /node(\.exe)?\b/i.test(proc?.name ?? '') || /node(\.exe)?\b/i.test(proc?.cmd ?? '');
    if (isNode) {
      portOnly.push({ pid, ports, cmd: proc?.cmd ?? '(unknown)' });
    } else {
      blockedPorts.push({ pid, ports, cmd: proc?.cmd ?? '(unknown)' });
    }
  }

  // Kill deepest roots first: killing a parent with /T tears down its children,
  // which would make a later child PID look like a failure.
  const orderedRoots = [...roots].sort((a, b) => (depthOf.get(b) ?? 0) - (depthOf.get(a) ?? 0));

  return { roots: orderedRoots, portOnly, blockedPorts, processes, portError: error };
}

function killTree(pid) {
  if (IS_WINDOWS) {
    try {
      execFileSync('taskkill', ['/F', '/T', '/PID', pid], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  // POSIX: kill the process group, then the process itself.
  let ok = false;
  try {
    process.kill(Number(pid), 'SIGTERM');
    ok = true;
  } catch {
    ok = false;
  }
  return ok;
}

function main() {
  const dryRun = process.argv.slice(2).some((arg) => arg === '-n' || arg === '--dry-run');

  console.log(`SkillSwap dev-stop  (repo: ${ROOT})\n`);
  const { roots, portOnly, blockedPorts, processes, portError } = findTargets();
  const byPid = new Map(processes.map((p) => [p.pid, p]));

  if (!roots.length && !portOnly.length && !blockedPorts.length) {
    console.log('Nothing to stop — no SkillSwap dev processes found.');
    if (portError) console.log(`(port scan unavailable: ${portError})`);
    return;
  }

  console.log(dryRun ? 'Would stop these trees:' : 'Stopping these trees:');
  for (const pid of roots) {
    const proc = byPid.get(pid);
    const label = proc ? proc.cmd.slice(0, 88) : '(unknown)';
    console.log(`  pid ${String(pid).padEnd(7)} ${label}`);
  }

  if (portOnly.length) {
    console.log(dryRun ? '\nWould free these ports:' : '\nFreeing these ports:');
    for (const entry of portOnly) {
      console.log(
        `  :${entry.ports.join(', :').padEnd(14)} pid ${entry.pid}  ${entry.cmd.slice(0, 64)}`,
      );
    }
  }

  if (blockedPorts.length) {
    console.log('\nThese dev ports are held by something that is NOT a node dev server.');
    console.log('Reported only — not killed. Stop them yourself if they are stale:');
    for (const entry of blockedPorts) {
      console.log(
        `  :${entry.ports.join(', :').padEnd(14)} pid ${entry.pid}  ${entry.cmd.slice(0, 64)}`,
      );
    }
  }

  if (dryRun) {
    console.log('\nDry run — nothing killed. Re-run without -n to stop them.');
    return;
  }

  console.log('');
  const killed = new Set();
  for (const pid of roots) {
    if (killed.has(pid)) continue;
    const ok = killTree(pid);
    if (ok) killed.add(pid);
    console.log(`  ${ok ? 'killed' : 'MISS  '}  pid ${pid}`);
  }
  for (const entry of portOnly) {
    if (killed.has(entry.pid)) continue;
    const ok = killTree(entry.pid);
    if (ok) killed.add(entry.pid);
    console.log(`  ${ok ? 'killed' : 'lost  '}  pid ${entry.pid} (port holder)`);
  }

  // Give the OS a moment to release the sockets, then verify.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 750);
  const { holders } = portHolders();
  const stillHeld = [...holders.entries()];

  console.log('');
  if (stillHeld.length) {
    console.log('Ports still held (something restarted itself):');
    for (const [pid, ports] of stillHeld) {
      console.log(`  :${[...ports].sort((a, b) => a - b).join(', :')} pid ${pid}`);
    }
    console.log('Re-run `pnpm dev:stop`.');
    process.exitCode = 1;
  } else {
    console.log(`All dev ports free: ${PORTS.join(', ')}`);
  }
}

main();
