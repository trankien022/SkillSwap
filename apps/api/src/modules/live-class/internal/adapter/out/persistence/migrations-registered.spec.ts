/**
 * ADR-014 / ADR-013 Amendment A: every migration file this module ships must be **registered** in
 * its data source.
 *
 * TypeORM only runs what the `migrations` array names, so an unregistered file is invisible:
 * `pnpm db:migrate` reports "up to date" and the column silently does not exist. That is exactly
 * what happened while adding `next_attempt_at` to `live-class`, and again in `schedule`, whose
 * relay failed on every poll with "column next_attempt_at does not exist" — while nothing went
 * red, because the affected rows were no-ops.
 *
 * This guard lives inside the module it guards, not in `bootstrap/`: module isolation forbids
 * anything outside a module from importing its internals (ADR-005/ADR-011), and an exemption for
 * this file would re-open the door for every future one. The cost is one copy per module, which
 * `spec-guards-are-wired` pins so a copy cannot silently disappear.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ApiConfig } from '../../../../../../shared/config/api-config';
import { createModuleDataSource } from './data-source';

const CONFIG = {
  databaseHost: 'localhost',
  databasePort: 5432,
  databaseName: 'skillswap',
  databasePassword: 'x',
  databaseCredentials: () => ({ user: 'x', password: 'x' }),
} as unknown as ApiConfig;

/** The migrations this schema must carry. Named by timestamp so a rename cannot hide one. */
const REQUIRED: string[] = [
  '1791072000500', // outbox retry backoff (W2 C2)
  '1791072000600', // outbox aggregate sequence (W2 C1)
  '1791072000601', // consumer sequence watermark (W2 C1)
];

describe('live-class migrations are registered (ADR-014)', () => {
  it('registers every migration file, so none is silently skipped', () => {
    const migrations = (createModuleDataSource(CONFIG).options.migrations ?? []) as Array<
      string | { name?: string }
    >;
    const registered = migrations.map((migration) =>
      typeof migration === 'string' ? migration : (migration.name ?? ''),
    );
    const files = readdirSync(join(__dirname, 'migrations')).filter(
      (file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'),
    );

    expect(files.length).toBeGreaterThan(0);
    const missing = files.filter((file) => {
      const timestamp = file.split('-')[0] as string;
      return !registered.some((name) => name.includes(timestamp));
    });
    expect(missing).toEqual([]);
  });

  it.each(REQUIRED)('carries the %s migration required by the shared messaging code', (timestamp) => {
    const migrations = (createModuleDataSource(CONFIG).options.migrations ?? []) as Array<
      string | { name?: string }
    >;
    expect(
      migrations.map((migration) => (typeof migration === 'string' ? migration : migration.name)),
    ).toEqual(expect.arrayContaining([expect.stringContaining(timestamp)]));
  });
});
