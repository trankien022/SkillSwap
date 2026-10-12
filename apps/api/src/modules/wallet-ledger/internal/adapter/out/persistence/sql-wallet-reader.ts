import type { PageMeta, WalletHistoryItemView, WalletHistoryPage } from '@skillswap/contracts';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { decodeCursor, encodeCursor } from '../../../../../../shared/http/keyset-cursor';
import type { HistoryQuery, WalletReader } from '../../../application/port/out/wallet-reader';

const LEDGER_TABLE = 'ledger_entries';

interface EntryRow {
  id: string | number;
  entry_type: string;
  direction: string;
  amount_credits: number;
  reference_id: string | null;
  created_at: Date | string;
}

/** Entries that represent a reversed/refunded effect (ADR-022 display mapping). */
const REVERSED_TYPES = new Set(['reversal', 'refund']);

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toItem(row: EntryRow): WalletHistoryItemView {
  return {
    id: String(row.id),
    type: row.entry_type,
    direction: row.direction === 'debit' ? 'debit' : 'credit',
    amountCredits: row.amount_credits,
    status: REVERSED_TYPES.has(row.entry_type) ? 'reversed' : 'completed',
    reference: row.reference_id,
    createdAt: iso(row.created_at),
  };
}

export class SqlWalletReader implements WalletReader {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), LEDGER_TABLE);
  }

  async history(query: HistoryQuery): Promise<WalletHistoryPage> {
    const source = this.registry.get(this.moduleName);
    const cursor = decodeCursor(query.cursor);

    // Page + count share one filtered WHERE and run in a single transaction (NFR-014) so the
    // total is coincident with the page (approximate under concurrent writes).
    return source.transaction(async (manager) => {
      const params: unknown[] = [query.ownerId, query.limit + 1];
      let where = `"owner_id" = $1`;
      if (cursor !== null) {
        where += ` AND ("created_at", "id") < ($3::timestamptz, $4::bigint)`;
        params.push(cursor[0], cursor[1]);
      }

      const [rows, countRows] = await Promise.all([
        manager.query(
          `SELECT "id", "entry_type", "direction", "amount_credits", "reference_id", "created_at"
             FROM ${this.table}
            WHERE ${where}
            ORDER BY "created_at" DESC, "id" DESC
            LIMIT $2`,
          params,
        ) as Promise<EntryRow[]>,
        manager.query(
          `SELECT COUNT(*)::int AS "total" FROM ${this.table} WHERE "owner_id" = $1`,
          [query.ownerId],
        ) as Promise<Array<{ total: number }>>,
      ]);

      const hasMore = rows.length > query.limit;
      const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
      const last = pageRows[pageRows.length - 1];
      const page: PageMeta = {
        limit: query.limit,
        nextCursor:
          hasMore && last !== undefined ? encodeCursor([iso(last.created_at), String(last.id)]) : null,
        total: countRows[0]?.total ?? 0,
      };
      return { items: pageRows.map(toItem), page };
    });
  }

  async sums(ownerId: string): Promise<{ credits: number; debits: number }> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT
         COALESCE(SUM("amount_credits") FILTER (WHERE "direction" = 'credit'), 0)::int AS "credits",
         COALESCE(SUM("amount_credits") FILTER (WHERE "direction" = 'debit'), 0)::int AS "debits"
       FROM ${this.table} WHERE "owner_id" = $1`,
      [ownerId],
    )) as Array<{ credits: number; debits: number }>;
    return { credits: rows[0]?.credits ?? 0, debits: rows[0]?.debits ?? 0 };
  }
}
