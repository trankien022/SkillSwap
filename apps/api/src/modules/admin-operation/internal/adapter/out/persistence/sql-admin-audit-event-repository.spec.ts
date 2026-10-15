import { SqlAdminAuditEventRepository } from './sql-admin-audit-event-repository';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { InvalidCursorError } from '../../../../../../shared/errors';
import { encodeCursor } from '../../../../../../shared/http/keyset-cursor';
import type { AdminAuditEventInput } from '../../../domain/audit-event';

/**
 * FR-015 / ADR-034: the append-only audit store.
 *
 * The properties pinned here are the ones the rest of the feature leans on: appends are
 * idempotent on `source_event_id` (so at-least-once delivery cannot duplicate a row), the page
 * and its count share one `WHERE` and one transaction (so `total` describes the rows returned),
 * and filters are parameterised rather than interpolated.
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

  const dataSource = { query: mockQuery };
  const registry = {
    getSchema: jest.fn(() => 'admin_operation'),
    get: jest.fn(() => dataSource),
  } as unknown as ModuleDataSourceRegistry;

  return { registry, recordedQueries };
}

function auditRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'a-1',
    actor_id: 'admin-1',
    action: 'skill.verifier.suspended',
    target_type: 'verifier_account',
    target_id: 'vf-1',
    old_state: { status: 'active' },
    new_state: { status: 'suspended' },
    occurred_at: new Date('2026-10-15T00:00:00.000Z'),
    trace_id: null,
    metadata: null,
    source_event_id: 'evt-1',
    ...overrides,
  };
}

function appendInput(overrides: Partial<AdminAuditEventInput> = {}): AdminAuditEventInput {
  return {
    actorId: 'admin-1',
    action: 'skill.verifier.suspended',
    targetType: 'verifier_account',
    targetId: 'vf-1',
    oldState: { status: 'active' },
    newState: { status: 'suspended' },
    occurredAt: new Date('2026-10-15T00:00:00.000Z'),
    traceId: null,
    metadata: null,
    sourceEventId: 'evt-1',
    ...overrides,
  };
}

describe('SqlAdminAuditEventRepository.append', () => {
  it('inserts the row and reports that it was written', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[{ id: 'a-1' }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    const written = await repository.append(appendInput());

    expect(written).toBe(true);
    expect(recordedQueries[0].sql).toContain('INSERT INTO "admin_operation"."admin_audit_event"');
  });

  it('conflicts on a partial unique index over source_event_id, not on the primary key', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[{ id: 'a-1' }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    await repository.append(appendInput());

    expect(recordedQueries[0].sql).toContain(
      'ON CONFLICT ("source_event_id") WHERE "source_event_id" IS NOT NULL DO NOTHING',
    );
  });

  it('reports false when the row already existed, so redelivery is a no-op', async () => {
    const { registry } = createRecordingRegistry([[]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    await expect(repository.append(appendInput())).resolves.toBe(false);
  });

  it('parameterises every column and never interpolates a value', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[{ id: 'a-1' }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    await repository.append(appendInput({ targetId: "'; DROP TABLE admin_audit_event; --" }));

    expect(recordedQueries[0].sql).not.toContain('DROP TABLE');
    expect(recordedQueries[0].params).toContain("'; DROP TABLE admin_audit_event; --");
  });

  it('serialises the snapshots as JSON rather than storing objects', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[{ id: 'a-1' }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    await repository.append(appendInput());

    const params = recordedQueries[0].params ?? [];
    expect(params).toContain(JSON.stringify({ status: 'active' }));
    expect(params).toContain(JSON.stringify({ status: 'suspended' }));
  });

  it('leaves a null snapshot null instead of writing the string "null"', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[{ id: 'a-1' }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    await repository.append(appendInput({ oldState: null, metadata: null }));

    const params = recordedQueries[0].params ?? [];
    expect(params).toContain(null);
    expect(params).not.toContain('null');
  });
});

describe('SqlAdminAuditEventRepository.list', () => {
  it('orders newest-first by default, because a log is read from the present backwards', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    await repository.list({ limit: 20 });

    expect(recordedQueries[0].sql).toContain('ORDER BY "occurred_at" DESC, "id" DESC');
  });

  it('honours an explicit oldest-first sort', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    await repository.list({ limit: 20, sort: 'occurredAt' });

    expect(recordedQueries[0].sql).toContain('ORDER BY "occurred_at" ASC, "id" ASC');
  });

  it('runs the page and the count together with the same filters', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 4 }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    const page = await repository.list({
      limit: 20,
      actorId: 'admin-1',
      action: 'skill.verifier.suspended',
    });

    expect(recordedQueries).toHaveLength(2);
    expect(recordedQueries[1].sql).toContain('COUNT(*)');
    expect(recordedQueries[1].sql).toContain('"actor_id" = $1');
    expect(recordedQueries[1].sql).toContain('"action" = $2');
    expect(recordedQueries[1].sql).not.toContain('ORDER BY');
    expect(recordedQueries[1].params).toEqual(['admin-1', 'skill.verifier.suspended']);
    expect(page.total).toBe(4);
  });

  it('filters on an inclusive time range', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    await repository.list({
      limit: 20,
      from: new Date('2026-10-01T00:00:00.000Z'),
      to: new Date('2026-10-15T00:00:00.000Z'),
    });

    expect(recordedQueries[0].sql).toContain('"occurred_at" >= $1::timestamptz');
    expect(recordedQueries[0].sql).toContain('"occurred_at" <= $2::timestamptz');
    expect(recordedQueries[0].params).toContain('2026-10-01T00:00:00.000Z');
    expect(recordedQueries[0].params).toContain('2026-10-15T00:00:00.000Z');
  });

  it('wraps the free-text term for the target id', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    await repository.list({ limit: 20, q: 'vf-1' });

    expect(recordedQueries[0].sql).toContain('"target_id" ILIKE $1');
    expect(recordedQueries[0].params).toContain('%vf-1%');
  });

  it('keysets on (occurred_at, id) in the same direction as the sort', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    await repository.list({
      limit: 20,
      cursor: encodeCursor(['2026-10-15T00:00:00.000Z', 'a-1']),
    });

    expect(recordedQueries[0].sql).toMatch(
      /\("occurred_at", "id"\) < \(\$\d+::timestamptz, \$\d+::uuid\)/,
    );
  });

  it('flips the keyset comparison for oldest-first', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    await repository.list({
      limit: 20,
      sort: 'occurredAt',
      cursor: encodeCursor(['2026-10-15T00:00:00.000Z', 'a-1']),
    });

    expect(recordedQueries[0].sql).toMatch(
      /\("occurred_at", "id"\) > \(\$\d+::timestamptz, \$\d+::uuid\)/,
    );
  });

  it('still emits a valid WHERE clause when a cursor is given with no filters', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    await repository.list({
      limit: 20,
      cursor: encodeCursor(['2026-10-15T00:00:00.000Z', 'a-1']),
    });

    expect(recordedQueries[0].sql).toContain('WHERE ("occurred_at", "id")');
    expect(recordedQueries[0].sql).not.toContain('WHERE  AND');
  });

  it('asks for limit+1 rows and emits a cursor from the last returned row', async () => {
    const rows = [
      auditRow({ id: 'a-2', occurred_at: new Date('2026-10-15T00:00:00.000Z') }),
      auditRow({ id: 'a-1', occurred_at: new Date('2026-10-14T00:00:00.000Z') }),
      auditRow({ id: 'a-0', occurred_at: new Date('2026-10-13T00:00:00.000Z') }),
    ];
    const { registry, recordedQueries } = createRecordingRegistry([rows, [{ total: 3 }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    const page = await repository.list({ limit: 2 });

    expect(recordedQueries[0].params).toContain(3);
    expect(page.items.map((item) => item.id)).toEqual(['a-2', 'a-1']);
    expect(page.nextCursor).toBe(encodeCursor(['2026-10-14T00:00:00.000Z', 'a-1']));
  });

  it('maps the row to the general audit-event view', async () => {
    const { registry } = createRecordingRegistry([[auditRow()], [{ total: 1 }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    const page = await repository.list({ limit: 20 });

    expect(page.items[0]).toEqual({
      id: 'a-1',
      actorId: 'admin-1',
      action: 'skill.verifier.suspended',
      targetType: 'verifier_account',
      targetId: 'vf-1',
      oldState: { status: 'active' },
      newState: { status: 'suspended' },
      occurredAt: '2026-10-15T00:00:00.000Z',
      traceId: null,
      metadata: null,
      sourceEventId: 'evt-1',
    });
  });

  it('tolerates a timestamp returned as a string rather than a Date', async () => {
    const { registry } = createRecordingRegistry([
      [auditRow({ occurred_at: '2026-10-15T00:00:00.000Z' })],
      [{ total: 1 }],
    ]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    const page = await repository.list({ limit: 20 });

    expect(page.items[0].occurredAt).toBe('2026-10-15T00:00:00.000Z');
  });

  it('rejects a cursor that does not carry two key parts', async () => {
    const { registry } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    await expect(
      repository.list({ limit: 20, cursor: encodeCursor(['only-one']) }),
    ).rejects.toBeInstanceOf(InvalidCursorError);
  });

  it('returns an empty page with a zero total when nothing matches', async () => {
    const { registry } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    const page = await repository.list({ limit: 20, actorId: 'nobody' });

    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
    expect(page.total).toBe(0);
  });

  it('never issues an UPDATE or DELETE, in any method (NFR-005)', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([
      [{ id: 'a-1' }],
      [],
      [{ total: 0 }],
    ]);
    const repository = new SqlAdminAuditEventRepository(registry, 'admin-operation');

    await repository.append(appendInput());
    await repository.list({ limit: 20 });

    for (const { sql } of recordedQueries) {
      expect(sql).not.toMatch(/\bUPDATE\b/);
      expect(sql).not.toMatch(/\bDELETE\b/);
    }
  });
});
