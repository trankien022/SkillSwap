import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type { WalletBalance } from '../../../domain/wallet';
import type { ApplyTopUpRequest, WalletRepository } from '../../../application/port/out/wallet-repository';

interface BalanceRow {
  available_credits: number;
  pending_credits: number;
}

export class SqlWalletRepository implements WalletRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'wallets');
  }

  private get ledgerTable(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'ledger_entries');
  }

  async getBalance(ownerId: string): Promise<WalletBalance> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT "available_credits", "pending_credits" FROM ${this.table} WHERE "owner_id" = $1`,
      [ownerId],
    )) as BalanceRow[];
    const row = rows[0];
    if (row === undefined) {
      return { availableCredits: 0, pendingCredits: 0 };
    }
    return { availableCredits: row.available_credits, pendingCredits: row.pending_credits };
  }

  async addAvailable(ownerId: string, deltaCredits: number): Promise<WalletBalance> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `INSERT INTO ${this.table} ("owner_id", "available_credits", "updated_at")
       VALUES ($1, $2, now())
       ON CONFLICT ("owner_id") DO UPDATE
         SET "available_credits" = ${this.table}."available_credits" + $2, "updated_at" = now()
       RETURNING "available_credits", "pending_credits"`,
      [ownerId, deltaCredits],
    )) as BalanceRow[];
    const row = rows[0];
    return { availableCredits: row.available_credits, pendingCredits: row.pending_credits };
  }

  async applyTopUp(request: ApplyTopUpRequest): Promise<WalletBalance> {
    const source = this.registry.get(this.moduleName);
    const delta = request.direction === 'credit' ? request.amountCredits : -request.amountCredits;
    return source.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO ${this.ledgerTable}
           ("booking_id", "teacher_id", "amount_credits", "direction", "entry_type", "owner_id", "reference_id", "trace_id")
         VALUES (NULL, $1, $2, $3, $4, $1, $5, $6)`,
        [
          request.ownerId,
          request.amountCredits,
          request.direction,
          request.direction === 'credit' ? 'top_up' : 'reversal',
          request.intentId,
          request.traceId,
        ],
      );
      const rows = (await manager.query(
        `INSERT INTO ${this.table} ("owner_id", "available_credits", "updated_at")
         VALUES ($1, $2, now())
         ON CONFLICT ("owner_id") DO UPDATE
           SET "available_credits" = ${this.table}."available_credits" + $2, "updated_at" = now()
         RETURNING "available_credits", "pending_credits"`,
        [request.ownerId, delta],
      )) as BalanceRow[];
      const row = rows[0];
      return { availableCredits: row.available_credits, pendingCredits: row.pending_credits };
    });
  }
}
