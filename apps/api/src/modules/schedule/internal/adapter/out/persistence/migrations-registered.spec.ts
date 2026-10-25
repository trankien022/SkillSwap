import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createModuleDataSource } from './data-source';
import type { ApiConfig } from '../../../../../../shared/config/api-config';

/**
 * ADR-014 / ADR-013 Amendment A: every migration file a module ships must be **registered** in
 * its data source.
 *
 * TypeORM only runs what the `migrations` array names, so an unregistered file is invisible:
 * `pnpm db:migrate` reports "up to date" and the column silently does not exist.
 *
 * This module is the one that actually drifted: it gained an `outbox_messages` table but no
 * `next_attempt_at` migration, so its relay failed on every poll with
 * "column next_attempt_at does not exist" — and nothing went red, because the failing rows
 * were no-ops. The guard is the reason that can be noticed.
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

describe('schedule migrations are registered (ADR-014)', () => {
  it('registers every migration file, so none is silently skipped', () => {
    const registered = registeredMigrations();

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
      expect(registeredMigrations()).toEqual(
        expect.arrayContaining([expect.stringContaining(timestamp as string)]),
      );
    }
  });

  it('carries the outbox retry column its relay requires (ADR-013 Amendment A)', () => {
    // The relay's claim statement filters on `next_attempt_at`; without it every poll fails.
    expect(registeredMigrations()).toEqual(
      expect.arrayContaining([expect.stringContaining('AddOutboxRetryBackoff1791072000500')]),
    );
  });
});
