import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST_MODULES = join(ROOT, 'apps', 'api', 'dist', 'modules');

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
      // Strip an inline comment from an unquoted value ("off # comment" -> "off"),
      // matching how dotenv treats .env.example lines.
      value = value.replace(/\s+#.*$/, '').trim();
    }
    if (process.env[match[1]] === undefined && value !== '') {
      process.env[match[1]] = value;
    }
  }
}

async function importDataSources() {
  if (!existsSync(DIST_MODULES)) {
    throw new Error(`Missing ${DIST_MODULES} — run \`pnpm build\` first (db:migrate does this).`);
  }
  const modules = [];
  for (const entry of readdirSync(DIST_MODULES, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (!entry.isDirectory()) continue;
    const file = join(DIST_MODULES, entry.name, 'internal', 'adapter', 'out', 'persistence', 'data-source.js');
    if (!existsSync(file)) continue;
    const mod = await import(pathToFileURL(file).href);
    if (typeof mod.createModuleDataSource !== 'function') {
      throw new Error(`${file} does not export createModuleDataSource`);
    }
    modules.push({ name: entry.name, create: mod.createModuleDataSource });
  }
  if (modules.length === 0) {
    throw new Error('No module data sources found under apps/api/dist/modules');
  }
  return modules;
}

loadRootEnv();
const { ApiConfig } = await import(
  pathToFileURL(join(ROOT, 'apps', 'api', 'dist', 'shared', 'config', 'api-config.js')).href
);
const config = new ApiConfig();
const modules = await importDataSources();

let failed = false;
for (const { name, create } of modules) {
  const dataSource = create(config);
  try {
    await dataSource.initialize();
    const applied = await dataSource.runMigrations();
    if (applied.length === 0) {
      console.log(`  ${name}: up to date`);
    } else {
      for (const migration of applied) {
        console.log(`  ${name}: applied ${migration.name ?? migration.timestamp}`);
      }
    }
  } catch (error) {
    failed = true;
    console.error(`  ${name}: FAILED — ${error instanceof Error ? error.message : error}`);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

if (failed) {
  console.error('db:migrate failed');
  process.exitCode = 1;
} else {
  console.log(`db:migrate ok — ${modules.length} module schema(s)`);
}
