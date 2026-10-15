import {
  DEFAULT_PAGE_LIMIT,
  type AuditLogPage,
  type AuditLogQueryInput,
} from '@skillswap/contracts';
import type { ListAuditLogPort } from '../port/in/list-audit-log';
import type { AdminAuditEventRepository } from '../port/out/admin-audit-event-repository';

/**
 * FR-015 / ADR-034: the Administrator's audit log, newest-first.
 *
 * The handler's only real job is translating the wire query into the repository's query: the
 * defaults (`limit`, the newest-first sort) and the ISO strings → `Date` conversion happen here
 * so the adapter deals in typed values and can keep its filters parameterised.
 *
 * There is no allow-list of actions or target types here. The contract deliberately keeps both
 * open (see `audit-event.ts`): the log must be able to show an action a module was audited for
 * after this handler shipped, and filtering on an unknown value simply returns an empty page.
 */
export class ListAuditLogQueryHandler implements ListAuditLogPort {
  constructor(private readonly audit: AdminAuditEventRepository) {}

  async execute(query: AuditLogQueryInput): Promise<AuditLogPage> {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const page = await this.audit.list({
      limit,
      cursor: query.cursor,
      actorId: query.actorId,
      action: query.action,
      targetType: query.targetType,
      targetId: query.targetId,
      from: query.from === undefined ? undefined : new Date(query.from),
      to: query.to === undefined ? undefined : new Date(query.to),
      q: query.q,
      // Newest-first is the default because a log is read from the present backwards; the
      // contract's negative-prefix convention marks the reverse, so `occurredAt` is the
      // exception that asks for oldest-first.
      sort: query.sort === 'occurredAt' ? 'occurredAt' : '-occurredAt',
    });

    return {
      items: page.items,
      page: { limit, nextCursor: page.nextCursor, total: page.total },
    };
  }
}
