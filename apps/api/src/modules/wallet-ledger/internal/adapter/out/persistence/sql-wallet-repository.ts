import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type { WalletBalance } from '../../../domain/wallet';
import { InsufficientBalanceError } from '../../../domain/wallet';
import type {
  ApplyTopUpRequest,
  ReleaseIncomeRequest,
  ReleaseIncomeResult,
  SettleBookingRequest,
  SettleBookingResult,
  WalletRepository,
} from '../../../application/port/out/wallet-repository';

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

  async settleBooking(request: SettleBookingRequest): Promise<SettleBookingResult> {
    const source = this.registry.get(this.moduleName);
    return source.transaction(async (manager) => {
      // Idempotency: at most one learner_debit per booking (ADR-018).
      const existing = (await manager.query(
        `SELECT 1 FROM ${this.ledgerTable} WHERE "entry_type" = 'learner_debit' AND "reference_id" = $1 LIMIT 1`,
        [request.bookingId],
      )) as unknown[];
      if (existing.length > 0) {
        return {
          applied: false,
          teacherCredits: request.teacherCredits,
          platformFeeCredits: request.platformFeeCredits,
        };
      }

      // Debit the Learner only if the balance covers the price (AC-005).
      const debited = (await manager.query(
        `UPDATE ${this.table}
           SET "available_credits" = "available_credits" - $2, "updated_at" = now()
         WHERE "owner_id" = $1 AND "available_credits" >= $2
         RETURNING "available_credits"`,
        [request.learnerId, request.priceCredits],
      )) as Array<{ available_credits: number }>;
      if (debited.length === 0) {
        const current = (await manager.query(
          `SELECT "available_credits" FROM ${this.table} WHERE "owner_id" = $1`,
          [request.learnerId],
        )) as Array<{ available_credits: number }>;
        throw new InsufficientBalanceError(current[0]?.available_credits ?? 0, request.priceCredits);
      }

      const insertLedger = async (
        ownerId: string,
        entryType: string,
        direction: 'credit' | 'debit',
        amount: number,
      ): Promise<void> => {
        await manager.query(
          `INSERT INTO ${this.ledgerTable}
             ("booking_id", "teacher_id", "amount_credits", "direction", "entry_type", "owner_id", "reference_id", "trace_id")
           VALUES (NULL, $1, $2, $3, $4, $1, $5, $6)`,
          [ownerId, amount, direction, entryType, request.bookingId, request.traceId],
        );
      };

      await insertLedger(request.learnerId, 'learner_debit', 'debit', request.priceCredits);
      await insertLedger(request.teacherId, 'teacher_pending', 'credit', request.teacherCredits);
      await insertLedger('platform', 'platform_fee', 'credit', request.platformFeeCredits);
      await manager.query(
        `INSERT INTO ${this.table} ("owner_id", "pending_credits", "updated_at")
         VALUES ($1, $2, now())
         ON CONFLICT ("owner_id") DO UPDATE
           SET "pending_credits" = ${this.table}."pending_credits" + $2, "updated_at" = now()`,
        [request.teacherId, request.teacherCredits],
      );

      return {
        applied: true,
        teacherCredits: request.teacherCredits,
        platformFeeCredits: request.platformFeeCredits,
      };
    });
  }

  async releaseIncome(request: ReleaseIncomeRequest): Promise<ReleaseIncomeResult> {
    const source = this.registry.get(this.moduleName);
    return source.transaction(async (manager) => {
      const inserted = (await manager.query(
        `INSERT INTO ${this.ledgerTable}
           ("booking_id", "teacher_id", "amount_credits", "direction", "entry_type", "owner_id", "reference_id", "release_key", "trace_id")
         VALUES (NULL, $1, $2, 'credit', 'release', $1, $3, $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING "id"`,
        [request.teacherId, request.amountCredits, request.bookingId, request.releaseKey, request.traceId],
      )) as Array<{ id: string | number }>;
      if (inserted.length === 0) {
        return { applied: false };
      }
      await manager.query(
        `UPDATE ${this.table}
           SET "pending_credits" = "pending_credits" - $2,
               "available_credits" = "available_credits" + $2,
               "updated_at" = now()
         WHERE "owner_id" = $1`,
        [request.teacherId, request.amountCredits],
      );
      return { applied: true };
    });
  }
}
