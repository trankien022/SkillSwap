import { accountStatusChangedSchema } from '@skillswap/contracts';
import { SqlAccountRepository } from './sql-account-repository';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';

interface RecordedQuery {
  sql: string;
  params?: unknown[];
}

/** A registry whose `query` and `transaction` both record what they were asked to run. */
function createRecordingRegistry(responses: unknown[]) {
  const recordedQueries: RecordedQuery[] = [];
  let index = 0;
  const run = async (sql: string, params?: unknown[]) => {
    recordedQueries.push({ sql, params });
    return responses[index++] ?? [];
  };
  const manager = { query: run };
  const source = {
    query: run,
    transaction: <T>(fn: (m: typeof manager) => Promise<T>) => fn(manager),
  };
  const registry = {
    get: () => source,
    getSchema: () => 'account_profile',
  } as unknown as ModuleDataSourceRegistry;
  return { registry, recordedQueries };
}

/** ADR-035: the Administrator acting, never the subject. */
const ADMIN_ACTOR = '8a1e0000-0000-4000-8000-0000000000a1';
const SUBJECT = '8a1e0000-0000-4000-8000-0000000000b2';

function accountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SUBJECT,
    email: 'minh@skillswap.test',
    display_name: 'Minh',
    role: 'user',
    status: 'active',
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    suspended_reason: null,
    suspended_by: null,
    suspended_at: null,
    ...overrides,
  };
}

describe('SqlAccountRepository.changeStatus (FR-015 / ADR-037)', () => {
  it('writes the suspension and emits an audited event in one transaction', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([
      [{ status: 'active' }],
      [
        accountRow({
          status: 'suspended',
          suspended_reason: 'Repeated payment fraud',
          suspended_by: ADMIN_ACTOR,
          suspended_at: new Date('2026-10-26T09:00:00.000Z'),
        }),
      ],
      [{ id: 'evt-1' }],
    ]);
    const repository = new SqlAccountRepository(registry, 'account-profile');

    const result = await repository.changeStatus({
      accountId: SUBJECT,
      status: 'suspended',
      reason: 'Repeated payment fraud',
      actorId: ADMIN_ACTOR,
      occurredAt: new Date('2026-10-26T09:00:00.000Z'),
    });

    expect(result?.changed).toBe(true);
    expect(result?.account.suspension?.reason).toBe('Repeated payment fraud');

    const insert = recordedQueries.find((q) => q.sql.includes('INSERT INTO'));
    expect(insert?.params?.[0]).toBe('account.status.changed');

    // The payload is schema-valid, and the actor is the Administrator — not the subject.
    const payload = accountStatusChangedSchema.parse(insert?.params?.[1]);
    expect(payload.actorId).toBe(ADMIN_ACTOR);
    expect(payload.accountId).toBe(SUBJECT);
    expect(payload.actorId).not.toBe(payload.accountId);
    expect(payload.previousStatus).toBe('active');
    expect(payload.status).toBe('suspended');
    expect(payload.reason).toBe('Repeated payment fraud');
  });

  it('reactivation clears the reason and the actor columns', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([
      [{ status: 'suspended' }],
      [accountRow({ status: 'active' })],
      [{ id: 'evt-1' }],
    ]);
    const repository = new SqlAccountRepository(registry, 'account-profile');

    const result = await repository.changeStatus({
      accountId: SUBJECT,
      status: 'active',
      reason: null,
      actorId: ADMIN_ACTOR,
      occurredAt: new Date('2026-10-26T10:00:00.000Z'),
    });

    expect(result?.changed).toBe(true);
    expect(result?.account.suspension).toBeUndefined();

    const update = recordedQueries.find((q) => q.sql.includes('SET "status"'));
    expect(update?.params?.slice(1)).toEqual(['active', null, null, null]);

    const payload = accountStatusChangedSchema.parse(
      recordedQueries.find((q) => q.sql.includes('INSERT INTO'))?.params?.[1],
    );
    expect(payload.reason).toBeNull();
    expect(payload.previousStatus).toBe('suspended');
  });

  it('is a no-op that emits nothing when the account is already in that status', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([
      [{ status: 'suspended' }],
      [
        accountRow({
          status: 'suspended',
          suspended_reason: 'Repeated payment fraud',
          suspended_by: ADMIN_ACTOR,
          suspended_at: new Date('2026-10-26T09:00:00.000Z'),
        }),
      ],
    ]);
    const repository = new SqlAccountRepository(registry, 'account-profile');

    const result = await repository.changeStatus({
      accountId: SUBJECT,
      status: 'suspended',
      reason: 'Repeated payment fraud',
      actorId: ADMIN_ACTOR,
      occurredAt: new Date('2026-10-26T11:00:00.000Z'),
    });

    expect(result?.changed).toBe(false);
    // A second audit row for an act that did not happen would make the log lie.
    expect(recordedQueries.some((q) => q.sql.includes('INSERT INTO'))).toBe(false);
    // `FOR UPDATE` on the read is not a write; the status statement is.
    expect(recordedQueries.some((q) => q.sql.includes('SET "status"'))).toBe(false);
  });

  it('reads the row out of the `[rows, count]` tuple a transactional UPDATE yields', async () => {
    // The pg driver wraps an UPDATE's result as `[rows, affectedCount]`. A spec that hands back a
    // bare `[row]` cannot tell the two apart, which is how the first version of this method shipped
    // with `row` being the row *array* — the audited payload then failed its own schema at runtime
    // while these tests stayed green. Feeding the real shape is the whole point of this case.
    const { registry, recordedQueries } = createRecordingRegistry([
      [{ status: 'active' }],
      [
        [
          accountRow({
            status: 'suspended',
            suspended_reason: 'Repeated payment fraud',
            suspended_by: ADMIN_ACTOR,
            suspended_at: new Date('2026-10-26T09:00:00.000Z'),
          }),
        ],
        1,
      ],
      [{ id: 'evt-1' }],
    ]);
    const repository = new SqlAccountRepository(registry, 'account-profile');

    const result = await repository.changeStatus({
      accountId: SUBJECT,
      status: 'suspended',
      reason: 'Repeated payment fraud',
      actorId: ADMIN_ACTOR,
      occurredAt: new Date('2026-10-26T09:00:00.000Z'),
    });

    expect(result?.account.id).toBe(SUBJECT);
    const payload = accountStatusChangedSchema.parse(
      recordedQueries.find((q) => q.sql.includes('INSERT INTO'))?.params?.[1],
    );
    expect(payload.accountId).toBe(SUBJECT);
  });

  it('returns null for an unknown account', async () => {
    const { registry } = createRecordingRegistry([[]]);
    const repository = new SqlAccountRepository(registry, 'account-profile');

    await expect(
      repository.changeStatus({
        accountId: SUBJECT,
        status: 'suspended',
        reason: 'anything',
        actorId: ADMIN_ACTOR,
        occurredAt: new Date('2026-10-26T09:00:00.000Z'),
      }),
    ).resolves.toBeNull();
  });
});
