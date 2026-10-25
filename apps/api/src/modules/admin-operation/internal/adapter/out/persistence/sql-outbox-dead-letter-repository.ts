import type { OutboxDeadLetterView } from '@skillswap/contracts';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { OUTBOX_TABLE } from '../../../../../../shared/messaging/constants';
import { replayDeadLetterStatement } from '../../../../../../shared/messaging/outbox-statements';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import type {
  OutboxDeadLetterQuery,
  OutboxDeadLetterRepository,
  OutboxDeadLetterPage,
  ReplayOutboxResult,
} from '../../../application/port/out/outbox-dead-letter-repository';

/**
 * FR-015 / ADR-013 Amendment A (W2 C3): the dead-letter inbox, read across every module's
 * own outbox table.
 *
 * This is the one place allowed to look at another module's schema, and only for the
 * `outbox_messages` table the shared messaging layer owns — never for module rows. The
 * alternative is an endpoint that lies about a queue it cannot see; the dead letters are
 * infrastructure state, not a bounded context's domain (ADR-013), so there is no owning
 * module to delegate to.
 *
 * A `DEAD` row has no `failed_at` column: `attempts` is incremented and `status` flips in
 * the same statement, so the moment of failure is not stored separately. `createdAt` is
 * therefore the only timestamp available and is used as `failedAt`, which is honest for a
 * row that was retried to exhaustion over a handful of ticks.
 */

const SELECT_COLUMNS =
  '"id", "event_type", "payload", "attempts", "last_error", "created_at"';

interface DeadLetterRow {
  id: string;
  event_type: string;
  payload: unknown;
  attempts: number;
  last_error: string | null;
  created_at: Date | string;
  module?: string;
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toView(row: DeadLetterRow, module: string): OutboxDeadLetterView {
  return {
    module,
    id: row.id,
    eventType: row.event_type,
    attempts: row.attempts,
    lastError: row.last_error,
    createdAt: toIso(row.created_at),
    failedAt: toIso(row.created_at),
    payload: row.payload,
  };
}

export class SqlOutboxDeadLetterRepository implements OutboxDeadLetterRepository {
  constructor(private readonly registry: ModuleDataSourceRegistry) {}

  /**
   * Reads one page per module and merges in memory.
   *
   * The seven schemas cannot be joined (ADR-014), so a single ordered page across them is
   * necessarily an application-level merge. Each module is over-fetched to
   * `offset + limit + 1` rows, which is enough to answer any prefix of the global ordering
   * for a bounded offset; `offset` is carried by the opaque cursor the port decodes.
   *
   * This is bounded by the number of modules (seven) and by `limit` (≤ 100), so the cost is
   * one small indexed query per schema rather than a scan of the whole outbox.
   */
  async list(query: OutboxDeadLetterQuery): Promise<OutboxDeadLetterPage> {
    const modules = this.modulesFor(query.module);
    const wanted = query.offset + query.limit + 1;

    const perModule = await Promise.all(
      modules.map(async (moduleName) => {
        const rows = (await this.registry
          .get(moduleName)
          .query(
            `SELECT ${SELECT_COLUMNS} FROM ${qualified(this.registry.getSchema(moduleName), OUTBOX_TABLE)}
              WHERE "status" = 'DEAD'
                ${query.eventType === undefined ? '' : 'AND "event_type" = $2'}
              ORDER BY "created_at" DESC, "id" DESC
              LIMIT $1`,
            query.eventType === undefined ? [wanted] : [wanted, query.eventType],
          )) as DeadLetterRow[];
        return rows.map((row) => ({ row, moduleName }));
      }),
    );

    const merged = perModule
      .flat()
      .sort((a, b) => {
        const left = toIso(a.row.created_at);
        const right = toIso(b.row.created_at);
        // Newest first, with the id as the unique tiebreaker so pages cannot skip or repeat.
        return left === right ? b.row.id.localeCompare(a.row.id) : right.localeCompare(left);
      });

    const page = merged.slice(query.offset, query.offset + query.limit);
    const hasMore = merged.length > query.offset + query.limit;

    return {
      items: page.map((entry) => toView(entry.row, entry.moduleName)),
      hasMore,
    };
  }

  /**
   * ADR-013 Amendment A (W2 C3): reset exactly one dead row to `PENDING`.
   *
   * The `WHERE status = 'DEAD'` guard is what makes a replay idempotent: a second replay of
   * the same row moves nothing and reports `replayed: false`, rather than resetting a row
   * that is already in flight or already published. `attempts` is reset so the retried event
   * gets a full budget — the payload was fixed, so the previous failures are history.
   */
  async replay(moduleName: string, id: string): Promise<ReplayOutboxResult> {
    const source = this.registry.get(moduleName);
    const table = qualified(this.registry.getSchema(moduleName), OUTBOX_TABLE);

    const rows = returnedRows<{ status: string }>(
      await source.query(replayDeadLetterStatement(this.registry.getSchema(moduleName)), [id]),
    );
    if (rows.length > 0) {
      return { replayed: true, status: 'PENDING' };
    }

    // Nothing moved: either the row is gone or it is no longer DEAD. Report which, so the
    // caller can tell a double click from an id that never existed.
    const existing = returnedRows<{ status: string }>(
      await source.query(`SELECT "status" FROM ${table} WHERE "id" = $1`, [id]),
    );
    const status = existing[0]?.status;
    if (status === 'PENDING' || status === 'PUBLISHED' || status === 'DEAD') {
      return { replayed: false, status };
    }
    return { replayed: false, status: 'DEAD' };
  }

  /**
   * ADR-013 Amendment A: the real backlog size, summed per schema.
   *
   * Seven indexed `COUNT(*)`s rather than a page estimate — an Administrator needs to know
   * whether the queue is empty, and "0" from a page that failed to read would be a lie.
   */
  async count(query: Omit<OutboxDeadLetterQuery, 'limit' | 'offset'>): Promise<number> {
    const modules = this.modulesFor(query.module);
    const counts = await Promise.all(
      modules.map(async (moduleName) => {
        const rows = returnedRows<{ total: number }>(
          await this.registry
            .get(moduleName)
            .query(
              `SELECT COUNT(*)::int AS "total" FROM ${qualified(this.registry.getSchema(moduleName), OUTBOX_TABLE)}
                WHERE "status" = 'DEAD'
                  ${query.eventType === undefined ? '' : 'AND "event_type" = $1'}`,
              query.eventType === undefined ? [] : [query.eventType],
            ),
        );
        return rows[0]?.total ?? 0;
      }),
    );
    return counts.reduce((sum, value) => sum + value, 0);
  }

  private modulesFor(moduleName: string | undefined): string[] {
    const all = this.registry.names();
    if (moduleName === undefined) {
      return all;
    }
    // An unknown module is an empty list rather than an error: the module registry is the
    // authority, and a typo should not read back as "this queue is empty".
    return all.includes(moduleName) ? [moduleName] : [];
  }
}
