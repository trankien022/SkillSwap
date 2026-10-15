import { DEFAULT_PAGE_LIMIT, type AuditEvent } from '@skillswap/contracts';
import { ListAuditLogQueryHandler } from './list-audit-log.query';
import type {
  AdminAuditEventRepository,
  AdminAuditPage,
  AdminAuditQuery,
} from '../port/out/admin-audit-event-repository';

/**
 * FR-015: the audit-log query handler.
 *
 * The handler is a thin translation layer, so what is worth pinning is the translation itself:
 * the default limit and sort, and the fact that the ISO strings on the wire become `Date`s the
 * adapter can bind. A handler that quietly forwarded the strings would push date parsing into
 * SQL and is exactly the kind of thing that passes by accident.
 */

class RecordingAuditRepository implements AdminAuditEventRepository {
  lastQuery: AdminAuditQuery | null = null;
  items: AuditEvent[] = [];
  total = 0;

  async append(): Promise<boolean> {
    return true;
  }

  async list(query: AdminAuditQuery): Promise<AdminAuditPage> {
    this.lastQuery = query;
    return { items: this.items, nextCursor: null, total: this.total };
  }
}

function auditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'a-1',
    actorId: 'admin-1',
    action: 'skill.verifier.suspended',
    targetType: 'verifier_account',
    targetId: 'vf-1',
    oldState: null,
    newState: null,
    occurredAt: '2026-10-15T00:00:00.000Z',
    traceId: null,
    metadata: null,
    sourceEventId: 'evt-1',
    ...overrides,
  };
}

describe('ListAuditLogQueryHandler', () => {
  it('applies the default limit when none is given', async () => {
    const repository = new RecordingAuditRepository();
    const handler = new ListAuditLogQueryHandler(repository);

    const page = await handler.execute({});

    expect(repository.lastQuery?.limit).toBe(DEFAULT_PAGE_LIMIT);
    expect(page.page.limit).toBe(DEFAULT_PAGE_LIMIT);
  });

  it('defaults to newest-first, because a log is read from the present backwards', async () => {
    const repository = new RecordingAuditRepository();
    const handler = new ListAuditLogQueryHandler(repository);

    await handler.execute({});

    expect(repository.lastQuery?.sort).toBe('-occurredAt');
  });

  it('passes an explicit oldest-first sort through', async () => {
    const repository = new RecordingAuditRepository();
    const handler = new ListAuditLogQueryHandler(repository);

    await handler.execute({ sort: 'occurredAt' });

    expect(repository.lastQuery?.sort).toBe('occurredAt');
  });

  it('converts the from/to bounds to Dates for the adapter', async () => {
    const repository = new RecordingAuditRepository();
    const handler = new ListAuditLogQueryHandler(repository);

    await handler.execute({ from: '2026-10-01T00:00:00.000Z', to: '2026-10-15T00:00:00.000Z' });

    expect(repository.lastQuery?.from).toBeInstanceOf(Date);
    expect(repository.lastQuery?.from?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(repository.lastQuery?.to?.toISOString()).toBe('2026-10-15T00:00:00.000Z');
  });

  it('leaves the bounds undefined when they are not supplied', async () => {
    const repository = new RecordingAuditRepository();
    const handler = new ListAuditLogQueryHandler(repository);

    await handler.execute({});

    expect(repository.lastQuery?.from).toBeUndefined();
    expect(repository.lastQuery?.to).toBeUndefined();
  });

  it('forwards every filter the SRS names', async () => {
    const repository = new RecordingAuditRepository();
    const handler = new ListAuditLogQueryHandler(repository);

    await handler.execute({
      actorId: 'admin-1',
      action: 'student.verification.approved',
      targetType: 'verification',
      targetId: 'v-1',
      q: 'vf',
      cursor: 'abc',
      limit: 5,
    });

    expect(repository.lastQuery).toMatchObject({
      actorId: 'admin-1',
      action: 'student.verification.approved',
      targetType: 'verification',
      targetId: 'v-1',
      q: 'vf',
      cursor: 'abc',
      limit: 5,
    });
  });

  it('returns the repository page unchanged', async () => {
    const repository = new RecordingAuditRepository();
    repository.items = [auditEvent()];
    repository.total = 9;
    const handler = new ListAuditLogQueryHandler(repository);

    const page = await handler.execute({ limit: 2 });

    expect(page.items).toEqual([auditEvent()]);
    expect(page.page.total).toBe(9);
    expect(page.page.nextCursor).toBeNull();
  });
});
