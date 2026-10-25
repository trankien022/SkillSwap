import { verifierStatusChangedSchema } from '@skillswap/contracts';
import { SqlVerifierRepository } from './sql-verifier-repository';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';

/** ADR-035: the Administrator performing the change, distinct from the Verifier. */
const ADMIN_ACTOR = '8a1e0000-0000-4000-8000-000000000b02';

/**
 * FR-004 / ADR-027 + FR-015 / ADR-034: a Verifier status change is a privileged action, and the
 * audit log can only record it if the change emits an event.
 *
 * `setStatus` previously wrote the status and nothing else, which meant an administrator could
 * suspend a Verifier and leave no trace. These pin the fix: the status write and its event commit
 * in the same transaction, the event carries the old→new pair the audit row needs, and a
 * reactivation is not silently mislabelled as a demotion.
 */

interface RecordedQuery {
  sql: string;
  params?: unknown[];
}

function createRecordingRegistry(responses: unknown[]) {
  const recordedQueries: RecordedQuery[] = [];
  const queue = [...responses];

  const mockQuery = jest.fn(async (sql: string, params?: unknown[]) => {
    recordedQueries.push({ sql, params });
    if (queue.length === 0) {
      throw new Error(`Unexpected query: ${sql}`);
    }
    const next = queue.shift();
    if (typeof next === 'function') {
      return (next as (sql: string, params?: unknown[]) => unknown)(sql, params);
    }
    if (next instanceof Error) {
      throw next;
    }
    return next;
  });

  const manager = { query: mockQuery };
  const dataSource = {
    query: mockQuery,
    transaction: jest.fn(async (fn: (m: typeof manager) => unknown) => fn(manager)),
  };
  const registry = {
    getSchema: jest.fn(() => 'skill_verification'),
    get: jest.fn(() => dataSource),
  } as unknown as ModuleDataSourceRegistry;

  return { registry, recordedQueries, dataSource };
}

function verifierRow() {
  return { account_id: 'vf-1', status: 'suspended', expertise: ['sk-1'] };
}

/** The `UPDATE … RETURNING` row: the account id plus the old status echoed back as $3. */
function updatedRow(previousStatus: string) {
  return { account_id: 'vf-1', previous_status: previousStatus };
}

describe('SqlVerifierRepository.setStatus', () => {
  it('reads the current status under a row lock before updating', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([
      [{ status: 'active' }],
      [updatedRow('active')],
      [],
      [verifierRow()],
      [],
    ]);
    const repository = new SqlVerifierRepository(registry, 'skill-verification');

    await repository.setStatus('vf-1', 'suspended', ADMIN_ACTOR);

    // `RETURNING` sees the post-update row, so the old value must be read first.
    expect(recordedQueries[0].sql).toContain('SELECT "status"');
    expect(recordedQueries[0].sql).toContain('FOR UPDATE');
  });

  it('writes the status and its event in one transaction', async () => {
    const { registry, dataSource } = createRecordingRegistry([
      [{ status: 'active' }],
      [updatedRow('active')],
      [],
      [verifierRow()],
      [],
    ]);
    const repository = new SqlVerifierRepository(registry, 'skill-verification');

    await repository.setStatus('vf-1', 'suspended', ADMIN_ACTOR);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('emits skill.verifier.suspended with the previous status', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([
      [{ status: 'active' }],
      [updatedRow('active')],
      [{ id: 'evt-1' }],
      [verifierRow()],
      [],
    ]);
    const repository = new SqlVerifierRepository(registry, 'skill-verification');

    await repository.setStatus('vf-1', 'suspended', ADMIN_ACTOR);

    const insert = recordedQueries.find((q) => q.sql.includes('INSERT INTO'));
    expect(insert?.sql).toContain('outbox_messages');
    expect(insert?.params?.[0]).toBe('skill.verifier.suspended');
    expect(insert?.params?.[1]).toMatchObject({
      verifierId: 'vf-1',
      status: 'suspended',
      previousStatus: 'active',
    });
    // ADR-035 Amendment A: the emitter validates before publishing, and the actor is the
    // Administrator who acted -- `verifierId` above is the account being changed.
    const payload = verifierStatusChangedSchema.parse(insert?.params?.[1]);
    expect(payload.actorId).toBe(ADMIN_ACTOR);
    expect(payload.actorId).not.toBe(payload.verifierId);
  });

  it('emits skill.verifier.revoked for a revocation', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([
      [{ status: 'suspended' }],
      [updatedRow('suspended')],
      [{ id: 'evt-1' }],
      [{ ...verifierRow(), status: 'revoked' }],
      [],
    ]);
    const repository = new SqlVerifierRepository(registry, 'skill-verification');

    await repository.setStatus('vf-1', 'revoked', ADMIN_ACTOR);

    const insert = recordedQueries.find((q) => q.sql.includes('INSERT INTO'));
    expect(insert?.params?.[0]).toBe('skill.verifier.revoked');
    expect(insert?.params?.[1]).toMatchObject({ previousStatus: 'suspended' });
  });

  it('emits nothing when the Verifier is reactivated', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([
      [{ status: 'suspended' }],
      [updatedRow('suspended')],
      [{ ...verifierRow(), status: 'active' }],
    ]);
    const repository = new SqlVerifierRepository(registry, 'skill-verification');

    await repository.setStatus('vf-1', 'active', ADMIN_ACTOR);

    expect(recordedQueries.some((q) => q.sql.includes('INSERT INTO'))).toBe(false);
  });

  it('does not emit when the Verifier does not exist', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[]]);
    const repository = new SqlVerifierRepository(registry, 'skill-verification');

    await expect(repository.setStatus('nope', 'suspended', ADMIN_ACTOR)).resolves.toBeNull();
    expect(recordedQueries.some((q) => q.sql.includes('INSERT INTO'))).toBe(false);
  });

  it('returns the reloaded Verifier after the update', async () => {
    const { registry } = createRecordingRegistry([
      [{ status: 'active' }],
      [updatedRow('active')],
      [{ id: 'evt-1' }],
      [verifierRow()],
    ]);
    const repository = new SqlVerifierRepository(registry, 'skill-verification');

    await expect(repository.setStatus('vf-1', 'suspended', ADMIN_ACTOR)).resolves.toEqual({
      accountId: 'vf-1',
      status: 'suspended',
      expertise: ['sk-1'],
    });
  });
});
