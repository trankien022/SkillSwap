import { SqlOutboxDeadLetterRepository } from './sql-outbox-dead-letter-repository';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';

/**
 * FR-015 / ADR-013 Amendment A (W2 C3, decided 2026-10-25): the dead-letter inbox.
 *
 * The properties pinned here are the ones the decision depends on: an Administrator only ever
 * sees rows the relay proved it cannot publish (`DEAD`), the merged page across seven schemas
 * is still newest-first and paginates without skipping, a replay touches exactly one row and
 * only when it is still `DEAD`, and the replay is idempotent so a double click cannot fabricate
 * a second piece of work.
 */

interface RecordedQuery {
  module: string;
  sql: string;
  params?: unknown[];
}

function deadRow(id: string, createdAt: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    event_type: 'class.completed',
    payload: { classId: 'cls-1' },
    attempts: 5,
    last_error: 'payload failed schema validation',
    created_at: new Date(createdAt),
    ...overrides,
  };
}

/**
 * A fake registry whose per-module responses are written by the test. Every module gets its
 * own queue of answers so a merged read can be asserted module by module.
 */
function createHarness(moduleResponses: Record<string, unknown[][]>) {
  const recorded: RecordedQuery[] = [];
  const queues = new Map(
    Object.entries(moduleResponses).map(([name, answers]) => [name, [...answers]]),
  );

  const registry = {
    names: () => [...queues.keys()],
    getSchema: (name: string) => name.replace(/-/g, '_'),
    get: (name: string) => ({
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        recorded.push({ module: name, sql, params });
        const queue = queues.get(name);
        const next = queue?.shift();
        if (next === undefined) {
          throw new Error(`Unexpected query for ${name}: ${sql}`);
        }
        return next;
      }),
    }),
  } as unknown as ModuleDataSourceRegistry;

  return { registry, recorded };
}

describe('SqlOutboxDeadLetterRepository (ADR-013 Amendment A, W2 C3)', () => {
  it('reads only DEAD rows, newest first, and merges every module', async () => {
    const { registry, recorded } = createHarness({
      'live-class': [[deadRow('b', '2026-10-25T00:00:00.000Z')]],
      'wallet-ledger': [[deadRow('a', '2026-10-25T01:00:00.000Z')]],
    });
    const repository = new SqlOutboxDeadLetterRepository(registry);

    const page = await repository.list({ limit: 20, offset: 0 });

    // Newest across the seven schemas, not per module then concatenated.
    expect(page.items.map((item) => item.module)).toEqual(['wallet-ledger', 'live-class']);
    expect(page.items[0]?.module).toBe('wallet-ledger');
    expect(page.hasMore).toBe(false);
    // Each module is queried for itself — no cross-schema SQL (ADR-014).
    expect(recorded).toHaveLength(2);
    for (const query of recorded) {
      expect(query.sql).toContain('\'DEAD\'');
      expect(query.sql).not.toMatch(/JOIN/i);
      expect(query.sql).toContain(`"${query.module.replace(/-/g, '_')}"."outbox_messages"`);
    }
  });

  it('pages across the merged ordering without skipping or repeating', async () => {
    const { registry } = createHarness({
      'live-class': [
        [deadRow('c', '2026-10-25T02:00:00.000Z'), deadRow('a', '2026-10-25T00:00:00.000Z')],
        [deadRow('c', '2026-10-25T02:00:00.000Z'), deadRow('a', '2026-10-25T00:00:00.000Z')],
      ],
      'wallet-ledger': [[deadRow('b', '2026-10-25T01:00:00.000Z')], [deadRow('b', '2026-10-25T01:00:00.000Z')]],
    });
    const repository = new SqlOutboxDeadLetterRepository(registry);

    const first = await repository.list({ limit: 2, offset: 0 });
    const second = await repository.list({ limit: 2, offset: 2 });

    expect(first.items.map((item) => item.id)).toEqual(['c', 'b']);
    expect(first.hasMore).toBe(true);
    expect(second.items.map((item) => item.id)).toEqual(['a']);
    expect(second.hasMore).toBe(false);
  });

  it('over-fetches per module so a page beyond the first is still correct', async () => {
    const { registry, recorded } = createHarness({
      'live-class': [
        [
          deadRow('c', '2026-10-25T03:00:00.000Z'),
          deadRow('b', '2026-10-25T02:00:00.000Z'),
          deadRow('a', '2026-10-25T01:00:00.000Z'),
        ],
      ],
    });
    const repository = new SqlOutboxDeadLetterRepository(registry);

    const page = await repository.list({ limit: 1, offset: 2 });

    expect(page.items.map((item) => item.id)).toEqual(['a']);
    // offset + limit + 1 = 4, which is what makes an arbitrary prefix answerable.
    expect(recorded[0]?.params).toEqual([4]);
  });

  it('filters one module and one event type when asked', async () => {
    const { registry, recorded } = createHarness({
      'live-class': [[]],
    });
    const repository = new SqlOutboxDeadLetterRepository(registry);

    await repository.list({ limit: 20, offset: 0, module: 'live-class', eventType: 'class.completed' });

    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.sql).toContain('"event_type" = $2');
    expect(recorded[0]?.params).toEqual([21, 'class.completed']);
  });

  it('treats an unknown module as an empty queue rather than an error', async () => {
    const { registry } = createHarness({ 'live-class': [[]] });
    const repository = new SqlOutboxDeadLetterRepository(registry);

    const page = await repository.list({ limit: 20, offset: 0, module: 'not-a-module' });

    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
  });

  it('replays one row only when it is still DEAD, resetting attempts', async () => {
    const { registry, recorded } = createHarness({
      'live-class': [[{ status: 'PENDING' }]],
    });
    const repository = new SqlOutboxDeadLetterRepository(registry);

    const result = await repository.replay('live-class', 'row-1');

    expect(result).toEqual({ replayed: true, status: 'PENDING' });
    // Guarded on the status that makes a replay legal, and due immediately on retry.
    expect(recorded[0]?.sql).toContain('status = \'DEAD\'');
    expect(recorded[0]?.sql).toContain('attempts = 0');
    expect(recorded[0]?.sql).toContain('next_attempt_at = NULL');
    expect(recorded[0]?.params).toEqual(['row-1']);
  });

  it('reports a double replay honestly instead of moving the row twice', async () => {
    // Nothing moved: report the row's real status so the caller can tell a double click from
    // an unknown id.
    const { registry } = createHarness({
      'live-class': [[], [{ status: 'PENDING' }]],
    });
    const repository = new SqlOutboxDeadLetterRepository(registry);

    const result = await repository.replay('live-class', 'row-1');

    expect(result).toEqual({ replayed: false, status: 'PENDING' });
  });

  it('reports an unknown row as not replayable without inventing a status', async () => {
    const { registry } = createHarness({
      'live-class': [[], []],
    });
    const repository = new SqlOutboxDeadLetterRepository(registry);

    const result = await repository.replay('live-class', 'missing');

    expect(result.replayed).toBe(false);
  });

  it('counts the real backlog across schemas, not the current page', async () => {
    const { registry } = createHarness({
      'live-class': [[{ total: 2 }]],
      'wallet-ledger': [[{ total: 3 }]],
    });
    const repository = new SqlOutboxDeadLetterRepository(registry);

    await expect(repository.count({})).resolves.toBe(5);
  });

  it('never exposes the payload of a non-DEAD row, because it only queries DEAD', async () => {
    const { registry, recorded } = createHarness({ 'live-class': [[]] });
    const repository = new SqlOutboxDeadLetterRepository(registry);

    await repository.list({ limit: 20, offset: 0 });

    expect(recorded[0]?.sql).toContain('"status" = \'DEAD\'');
  });
});
