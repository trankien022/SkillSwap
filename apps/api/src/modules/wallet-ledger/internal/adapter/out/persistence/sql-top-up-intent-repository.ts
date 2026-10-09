import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type { TopUpStatus } from '../../../domain/wallet';
import type {
  NewTopUpIntent,
  TopUpIntent,
  TopUpIntentRepository,
} from '../../../application/port/out/top-up-intent-repository';

interface IntentRow {
  id: string;
  owner_id: string;
  provider: string;
  provider_ref: string;
  amount_vnd: number;
  amount_credits: number;
  status: string;
}

function toIntent(row: IntentRow): TopUpIntent {
  return {
    id: row.id,
    ownerId: row.owner_id,
    provider: row.provider,
    providerRef: row.provider_ref,
    amountVnd: row.amount_vnd,
    amountCredits: row.amount_credits,
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
         ("owner_id", "provider", "provider_ref", "amount_vnd", "amount_credits")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING "id", "owner_id", "provider", "provider_ref", "amount_vnd", "amount_credits", "status"`,
      [input.ownerId, input.provider, input.providerRef, input.amountVnd, input.amountCredits],
    )) as IntentRow[];
    return toIntent(rows[0]);
  }

  async findByProviderRef(provider: string, providerRef: string): Promise<TopUpIntent | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT "id", "owner_id", "provider", "provider_ref", "amount_vnd", "amount_credits", "status"
       FROM ${this.table} WHERE "provider" = $1 AND "provider_ref" = $2 LIMIT 1`,
      [provider, providerRef],
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
}
