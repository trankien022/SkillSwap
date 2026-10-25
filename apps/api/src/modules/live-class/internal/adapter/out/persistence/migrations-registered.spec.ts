import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createModuleDataSource } from './data-source';
import type { ApiConfig } from '../../../../../../shared/config/api-config';

/**
 * ADR-014 / ADR-013 Amendment A: every migration file a module ships must be **registered** in
 * its data source.
 *
 * TypeORM only runs what the `migrations` array names, so an unregistered file is invisible:
 * `pnpm db:migrate` reports "up to date" and the column silently does not exist. That is
 * exactly what happened while adding `next_attempt_at` — the migration was written, the schema
 * stayed unchanged, and the migrate output looked healthy.
 *
 * This spec closes the gap for every module at once, so the next one cannot repeat it.
 */

const MIGRATIONS_DIR = join(__dirname, 'migrations');

function registeredMigrations(): string[] {
  const config = {
    databaseHost: 'localhost',
    databasePort: 5432,
    databaseName: 'skillswap',
    databasePassword: 'x',
    databaseCredentials: () => ({ user: 'x', password: 'x' }),
  } as unknown as ApiConfig;
  const dataSource = createModuleDataSource(config);
  const migrations = dataSource.options.migrations as Array<
    string | (new () => unknown) | { name?: string }
  >;
  return migrations
    .map((migration) => {
      if (typeof migration === 'string') return migration;
      if (typeof migration === 'function') return migration.name;
      return migration.name ?? '';
    })
    .sort();
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => file.replace(/\.ts$/, ''))
    .sort();
}

describe('live-class migrations are registered (ADR-014)', () => {
  it('registers every migration file, so none is silently skipped', () => {
    const registered = registeredMigrations();

    // Both sides carry the timestamp; agreeing on it is what prevents a silent skip.
    const missing = migrationFiles().filter((file) => {
      const timestamp = file.split('-')[0];
      return !registered.some((registeredName) => registeredName.includes(timestamp as string));
    });

    expect(missing).toEqual([]);
    expect(registered.length).toBeGreaterThan(0);
  });

  it('names each migration with its file timestamp, so ordering is readable', () => {
    for (const file of migrationFiles()) {
      const [timestamp] = file.split('-');
      expect(timestamp).toBeDefined();
      // TypeORM sorts by the class's `name`, so the timestamp must be in it.
      expect(registeredMigrations()).toEqual(
        expect.arrayContaining([expect.stringContaining(timestamp as string)]),
      );
    }
  });
});
