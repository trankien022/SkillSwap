import type { AuditEvent } from '@skillswap/contracts';
import { InvalidCursorError } from '../../../../../../shared/errors';
import { decodeCursor, toKeysetPage } from '../../../../../../shared/http/keyset-cursor';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import type { AdminAuditEventInput } from '../../../domain/audit-event';
import type {
  AdminAuditEventRepository,
  AdminAuditPage,
  AdminAuditQuery,
} from '../../../application/port/out/admin-audit-event-repository';

const TABLE = 'admin_audit_event';

const SELECT_COLUMNS =
  '"id", "actor_id", "action", "target_type", "target_id", "old_state", "new_state", ' +
  '"occurred_at", "trace_id", "metadata", "source_event_id"';

interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  old_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  occurred_at: Date | string;
  trace_id: string | null;
  metadata: Record<string, unknown> | null;
  source_event_id: string | null;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toView(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    oldState: (row.old_state as AuditEvent['oldState']) ?? null,
    newState: (row.new_state as AuditEvent['newState']) ?? null,
    occurredAt: toIso(row.occurred_at),
    traceId: row.trace_id,
    metadata: (row.metadata as AuditEvent['metadata']) ?? null,
    sourceEventId: row.source_event_id,
  };
}

/**
 * FR-015 / ADR-034: the append-only audit store, backed by `admin_operation.admin_audit_event`.
 *
 * Every method touches only this module's schema (ADR-014). The module's DB role has no
 * `UPDATE`/`DELETE` grant on the table, so append-only is a property of the deployment, not
 * merely of this class.
 */
export class SqlAdminAuditEventRepository implements AdminAuditEventRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), TABLE);
  }

  /**
   * Inserts a row, relying on the unique index over `source_event_id` (partial, where not null)
   * to make redelivery a no-op. `ON CONFLICT DO NOTHING` is what makes this safe under the
   * at-least-once delivery ADR-013 assumes — the processed-events table is the first line of
   * defence, and this is the second, so a `processed_events` reset cannot duplicate a row.
   */
  async append(input: AdminAuditEventInput): Promise<boolean> {
    const source = this.registry.get(this.moduleName);
    const rows = returnedRows<{ id: string }>(
      await source.query(
        `INSERT INTO ${this.table}
           ("actor_id", "action", "target_type", "target_id", "old_state", "new_state",
            "occurred_at", "trace_id", "metadata", "source_event_id")
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9::jsonb, $10)
         ON CONFLICT ("source_event_id") WHERE "source_event_id" IS NOT NULL DO NOTHING
         RETURNING "id"`,
        [
          input.actorId,
          input.action,
          input.targetType,
          input.targetId,
          input.oldState === null ? null : JSON.stringify(input.oldState),
          input.newState === null ? null : JSON.stringify(input.newState),
          input.occurredAt.toISOString(),
          input.traceId,
          input.metadata === null ? null : JSON.stringify(input.metadata),
          input.sourceEventId,
        ],
      ),
    );
    return rows.length > 0;
  }

  /**
   * FR-015 / NFR-014: the filtered log.
   *
   * Page and count share one `WHERE` and run in one transaction, so `total` cannot describe a
   * different set of rows than `items`. The default order is newest-first (an audit log is read
   * from the present backwards), keyset on `(occurred_at, id)` — `id` as the unique tiebreaker so
   * two rows sharing a timestamp cannot cause a page to skip or repeat.
   */
  async list(query: AdminAuditQuery): Promise<AdminAuditPage> {
    const source = this.registry.get(this.moduleName);

    const filters: string[] = [];
    const filterParams: unknown[] = [];
    const eq = (column: string, value: unknown): void => {
      filterParams.push(value);
      filters.push(`"${column}" = $${filterParams.length}`);
    };
    if (query.actorId !== undefined) eq('actor_id', query.actorId);
    if (query.action !== undefined) eq('action', query.action);
    if (query.targetType !== undefined) eq('target_type', query.targetType);
    if (query.targetId !== undefined) eq('target_id', query.targetId);
    if (query.from !== undefined) {
      filterParams.push(query.from.toISOString());
      filters.push(`"occurred_at" >= $${filterParams.length}::timestamptz`);
    }
    if (query.to !== undefined) {
      filterParams.push(query.to.toISOString());
      filters.push(`"occurred_at" <= $${filterParams.length}::timestamptz`);
    }
    if (query.q !== undefined) {
      filterParams.push(`%${query.q}%`);
      filters.push(`"target_id" ILIKE $${filterParams.length}`);
    }
    const where = filters.length === 0 ? '' : `WHERE ${filters.join(' AND ')}`;

    // Newest-first is the default: the log is read from now backwards.
    const asc = query.sort === 'occurredAt';
    const comparison = asc ? '>' : '<';
    const order = asc ? 'ASC' : 'DESC';

    const pageParams = [...filterParams];
    const pageFilters = [...filters];
    const decoded = decodeCursor(query.cursor);
    if (decoded !== null) {
      if (decoded.length !== 2) {
        throw new InvalidCursorError();
      }
      pageParams.push(decoded[0], decoded[1]);
      pageFilters.push(
        `("occurred_at", "id") ${comparison} ($${pageParams.length - 1}::timestamptz, $${pageParams.length}::uuid)`,
      );
    }
    pageParams.push(query.limit + 1);
    const limitParam = pageParams.length;
    const pageWhere = pageFilters.length === 0 ? '' : `WHERE ${pageFilters.join(' AND ')}`;

    const [rows, countRows] = await Promise.all([
      source.query(
        `SELECT ${SELECT_COLUMNS} FROM ${this.table}
          ${pageWhere}
          ORDER BY "occurred_at" ${order}, "id" ${order}
          LIMIT $${limitParam}`,
        pageParams,
      ) as Promise<AuditRow[]>,
      source.query(
        `SELECT COUNT(*)::int AS "total" FROM ${this.table} ${where}`,
        filterParams,
      ) as Promise<Array<{ total: number }>>,
    ]);

    const { items, nextCursor } = toKeysetPage(rows, query.limit, (row) => [
      toIso(row.occurred_at),
      row.id,
    ]);

    return { items: items.map(toView), nextCursor, total: countRows[0]?.total ?? 0 };
  }
}
