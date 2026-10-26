import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type { TopUpStatus } from '../../../domain/wallet';
import type {
  NewTopUpIntent,
  TopUpIntent,
  TopUpIntentRepository,
  TopUpSettlement,
} from '../../../application/port/out/top-up-intent-repository';

interface IntentRow {
  id: string;
  owner_id: string;
  provider: string;
  provider_ref: string;
  provider_order_id: string | null;
  amount_vnd: number;
  amount_credits: number;
  vnd_per_credit: number;
  paid_amount_vnd: number | null;
  paid_at: Date | null;
  status: string;
}

const COLUMNS = `"id", "owner_id", "provider", "provider_ref", "provider_order_id",
   "amount_vnd", "amount_credits", "vnd_per_credit", "paid_amount_vnd", "paid_at", "status"`;

function toIntent(row: IntentRow): TopUpIntent {
  return {
    id: row.id,
    ownerId: row.owner_id,
    provider: row.provider,
    providerRef: row.provider_ref,
    providerOrderId: row.provider_order_id,
    amountVnd: row.amount_vnd,
    amountCredits: row.amount_credits,
    vndPerCredit: row.vnd_per_credit,
    paidAmountVnd: row.paid_amount_vnd,
    paidAt: row.paid_at,
    status: row.status as TopUpStatus,
  };
}

export class SqlTopUpIntentRepository implements TopUpIntentRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'top_up_intents');
  }

  async create(input: NewTopUpIntent): Promise<TopUpIntent> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `INSERT INTO ${this.table}
         ("owner_id", "provider", "provider_ref", "amount_vnd", "amount_credits", "vnd_per_credit")
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLUMNS}`,
      [
        input.ownerId,
        input.provider,
        input.providerRef,
        input.amountVnd,
        input.amountCredits,
        input.vndPerCredit,
      ],
    )) as IntentRow[];
    return toIntent(rows[0]);
  }

  async findByProviderRef(provider: string, providerRef: string): Promise<TopUpIntent | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT ${COLUMNS}
       FROM ${this.table} WHERE "provider" = $1 AND "provider_ref" = $2 LIMIT 1`,
      [provider, providerRef],
    )) as IntentRow[];
    return rows[0] === undefined ? null : toIntent(rows[0]);
  }

  async findById(id: string): Promise<TopUpIntent | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT ${COLUMNS} FROM ${this.table} WHERE "id" = $1 LIMIT 1`,
      [id],
    )) as IntentRow[];
    return rows[0] === undefined ? null : toIntent(rows[0]);
  }

  async updateStatus(id: string, status: TopUpStatus): Promise<void> {
    const source = this.registry.get(this.moduleName);
    await source.query(
      `UPDATE ${this.table} SET "status" = $2, "updated_at" = now() WHERE "id" = $1`,
      [id, status],
    );
  }

  async recordSettlement(
    id: string,
    status: TopUpStatus,
    settlement: TopUpSettlement,
  ): Promise<void> {
    const source = this.registry.get(this.moduleName);
    await source.query(
      `UPDATE ${this.table}
         SET "status" = $2,
             "provider_order_id" = COALESCE($3, "provider_order_id"),
             "paid_amount_vnd" = COALESCE($4, "paid_amount_vnd"),
             "paid_at" = COALESCE($5, "paid_at"),
             "updated_at" = now()
       WHERE "id" = $1`,
      [
        id,
        status,
        settlement.providerOrderId,
        settlement.paidAmountVnd,
        settlement.paidAt,
      ],
    );
  }

  async findStalePending(olderThanMs: number, limit: number): Promise<TopUpIntent[]> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT ${COLUMNS}
       FROM ${this.table}
       WHERE "status" = 'pending' AND "created_at" < now() - ($1::bigint * interval '1 millisecond')
       ORDER BY "created_at" ASC
       LIMIT $2`,
      [olderThanMs, limit],
    )) as IntentRow[];
    return rows.map(toIntent);
  }
}
