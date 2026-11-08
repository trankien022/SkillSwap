import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import type { WalletBalance } from '../../../domain/wallet';
import { InsufficientBalanceError, splitSettlement } from '../../../domain/wallet';
import type {
  ApplyTopUpRequest,
  RefundBookingRequest,
  RefundBookingResult,
  ReleaseIncomeRequest,
  ReleaseIncomeResult,
  SettleBookingRequest,
  SettleBookingResult,
  WalletRepository,
} from '../../../application/port/out/wallet-repository';
import { walletTransactionCompletedEventSchema } from '@skillswap/contracts';
import { insertOutboxStatement } from '../../../../../../shared/messaging/outbox-statements';
import { OUTBOX_TABLE } from '../../../../../../shared/messaging/constants';

const WALLET_TRANSACTION_COMPLETED_EVENT = 'wallet.transaction.completed';
const BOOKING_LOCK_PREFIX = 'wallet_booking:';

interface BalanceRow {
  available_credits: number;
  pending_credits: number;
}

export class SqlWalletRepository implements WalletRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get schema(): string {
    return this.registry.getSchema(this.moduleName);
  }

  private get table(): string {
    return qualified(this.schema, 'wallets');
  }

  private get ledgerTable(): string {
    return qualified(this.schema, 'ledger_entries');
  }

  private get outboxTable(): string {
    return qualified(this.schema, OUTBOX_TABLE);
  }

  private async acquireBookingLock(
    manager: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    bookingId: string,
  ): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${BOOKING_LOCK_PREFIX}${bookingId}`,
    ]);
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

  /**
   * FR-008 / FR-016: applies a settled (or reversed) top-up.
   *
   * The ledger row, the balance change and the `wallet.transaction.completed` event are written in
   * **one** transaction, exactly as `settleBooking` does. Until this was fixed the top-up wrote the
   * ledger and the balance but emitted nothing, so `account-profile.notification-wallet-completed`
   * never fired for a top-up: a learner's money arrived silently. The booking path had the event
   * and the top-up path did not, which is precisely the kind of asymmetry a trace walkthrough
   * catches and a unit test does not.
   *
   * A **reversal** (`direction: 'debit'`) announces a `reversal` event, which B11 added to the
   * contract together with the SePay `TRANSACTION_VOID` producer that first needed it. Until then
   * this path was silent and unreachable: the enum had no member for "money taken back", and
   * inventing one with no producer would have invented a contract. The event is keyed on the
   * reversal's own ledger id, not the original credit's, because the two are separate movements of
   * money and a consumer joining on the id must land on the row that actually happened.
   */
  async applyTopUp(request: ApplyTopUpRequest): Promise<WalletBalance> {
    const source = this.registry.get(this.moduleName);
    const delta = request.direction === 'credit' ? request.amountCredits : -request.amountCredits;
    return source.transaction(async (manager) => {
      const inserted = await manager.query(
        `INSERT INTO ${this.ledgerTable}
           ("booking_id", "teacher_id", "amount_credits", "direction", "entry_type", "owner_id", "reference_id", "trace_id")
         VALUES (NULL, $1, $2, $3, $4, $1, $5, $6)
         RETURNING "id", "created_at"`,
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

      // Both directions announce themselves. The event's `transactionId` is the ledger row that
      // this call inserted, which for a reversal is the debit — so the announcement names the
      // movement that just happened, not the settlement it offsets.
      const ledgerRows = returnedRows<{ id: string | number; created_at: Date | string }>(inserted);
      const ledgerRow = ledgerRows[0];
      if (ledgerRow === undefined) {
        throw new Error(
          request.direction === 'credit'
            ? 'Failed to insert top-up ledger entry'
            : 'Failed to insert reversal ledger entry',
        );
      }
      const occurredAt = (
        ledgerRow.created_at instanceof Date ? ledgerRow.created_at : new Date(ledgerRow.created_at)
      ).toISOString();

      // ADR-035 Amendment A: parse before writing, so a payload that cannot satisfy the contract
      // fails inside this transaction rather than becoming a dead letter after the money landed.
      const payload = walletTransactionCompletedEventSchema.parse({
        transactionId: String(ledgerRow.id),
        accountId: request.ownerId,
        type: request.direction === 'credit' ? 'top_up' : 'reversal',
        amountCredits: request.amountCredits,
        direction: request.direction,
        occurredAt,
        actorId: request.actorId,
      });
      await manager.query(insertOutboxStatement(this.schema), [
        WALLET_TRANSACTION_COMPLETED_EVENT,
        payload,
      ]);

      return { availableCredits: row.available_credits, pendingCredits: row.pending_credits };
    });
  }

  async settleBooking(request: SettleBookingRequest): Promise<SettleBookingResult> {
    const source = this.registry.get(this.moduleName);
    return source.transaction(async (manager) => {
      // 1. Transaction-local advisory lock to serialize per booking
      await this.acquireBookingLock(manager, request.bookingId);

      // 2. Replay check: query existing learner_debit row
      const existing = (await manager.query(
        `SELECT "id", "owner_id", "amount_credits", "created_at" FROM ${this.ledgerTable}
           WHERE "entry_type" = 'learner_debit' AND "reference_id" = $1 LIMIT 1`,
        [request.bookingId],
      )) as Array<{
        id: string | number;
        owner_id: string;
        amount_credits: number;
        created_at: Date | string;
      }>;

      const existingDebit = existing[0];
      if (existingDebit !== undefined) {
        if (
          existingDebit.owner_id !== request.learnerId ||
          existingDebit.amount_credits !== request.priceCredits
        ) {
          throw new Error('Settlement request does not match existing booking settlement');
        }

        const transactionId = String(existingDebit.id);
        const occurredAt = (
          existingDebit.created_at instanceof Date
            ? existingDebit.created_at
            : new Date(existingDebit.created_at)
        ).toISOString();

        const existingOutbox = (await manager.query(
          `SELECT 1 FROM ${this.outboxTable}
             WHERE "event_type" = $1
               AND "payload"->>'transactionId' = $2
               AND "payload"->>'bookingId' = $3
             LIMIT 1`,
          [WALLET_TRANSACTION_COMPLETED_EVENT, transactionId, request.bookingId],
        )) as unknown[];

        if (existingOutbox.length === 0) {
          const payload = walletTransactionCompletedEventSchema.parse({
            transactionId,
            accountId: request.learnerId,
            type: 'booking_payment',
            amountCredits: request.priceCredits,
            direction: 'debit',
            occurredAt,
            bookingId: request.bookingId,
            actorId: request.actorId,
          });
          await manager.query(insertOutboxStatement(this.schema), [
            WALLET_TRANSACTION_COMPLETED_EVENT,
            payload,
          ]);
        }

        return {
          applied: false,
          teacherCredits: request.teacherCredits,
          platformFeeCredits: request.platformFeeCredits,
        };
      }

      // 3. Debit the Learner only if the balance covers the price (AC-005).
      const debited = returnedRows<{ available_credits: number }>(
        await manager.query(
          `UPDATE ${this.table}
             SET "available_credits" = "available_credits" - $2, "updated_at" = now()
           WHERE "owner_id" = $1 AND "available_credits" >= $2
           RETURNING "available_credits"`,
          [request.learnerId, request.priceCredits],
        ),
      );
      if (debited.length === 0) {
        const current = (await manager.query(
          `SELECT "available_credits" FROM ${this.table} WHERE "owner_id" = $1`,
          [request.learnerId],
        )) as Array<{ available_credits: number }>;
        throw new InsufficientBalanceError(current[0]?.available_credits ?? 0, request.priceCredits);
      }

      // 4. Insert learner_debit ledger entry with RETURNING id, created_at (durable identity).
      const insertedDebit = await manager.query(
        `INSERT INTO ${this.ledgerTable}
           ("booking_id", "teacher_id", "amount_credits", "direction", "entry_type", "owner_id", "reference_id", "trace_id")
         VALUES (NULL, $1, $2, $3, $4, $1, $5, $6)
         RETURNING "id", "created_at"`,
        [request.learnerId, request.priceCredits, 'debit', 'learner_debit', request.bookingId, request.traceId],
      );
      const debitRows = returnedRows<{ id: string | number; created_at: Date | string }>(insertedDebit);
      const debitRow = debitRows[0];
      if (!debitRow) {
        throw new Error('Failed to insert learner debit ledger entry');
      }

      // 5. Insert teacher_pending and platform_fee ledger entries.
      await manager.query(
        `INSERT INTO ${this.ledgerTable}
           ("booking_id", "teacher_id", "amount_credits", "direction", "entry_type", "owner_id", "reference_id", "trace_id")
         VALUES (NULL, $1, $2, $3, $4, $1, $5, $6)`,
        [request.teacherId, request.teacherCredits, 'credit', 'teacher_pending', request.bookingId, request.traceId],
      );
      if (request.platformFeeCredits > 0) {
        await manager.query(
          `INSERT INTO ${this.ledgerTable}
             ("booking_id", "teacher_id", "amount_credits", "direction", "entry_type", "owner_id", "reference_id", "trace_id")
           VALUES (NULL, $1, $2, $3, $4, $1, $5, $6)`,
          ['platform', request.platformFeeCredits, 'credit', 'platform_fee', request.bookingId, request.traceId],
        );
      }

      // 6. Credit teacher pending balance.
      await manager.query(
        `INSERT INTO ${this.table} ("owner_id", "pending_credits", "updated_at")
         VALUES ($1, $2, now())
         ON CONFLICT ("owner_id") DO UPDATE
           SET "pending_credits" = ${this.table}."pending_credits" + $2, "updated_at" = now()`,
        [request.teacherId, request.teacherCredits],
      );

      // 7. Emit wallet.transaction.completed outbox event using durable ledger identity.
      const transactionId = String(debitRow.id);
      const occurredAt = (
        debitRow.created_at instanceof Date
          ? debitRow.created_at
          : new Date(debitRow.created_at)
      ).toISOString();

      const payload = walletTransactionCompletedEventSchema.parse({
        transactionId,
        accountId: request.learnerId,
        type: 'booking_payment',
        amountCredits: request.priceCredits,
        direction: 'debit',
        occurredAt,
        bookingId: request.bookingId,
        actorId: request.actorId,
      });

      await manager.query(insertOutboxStatement(this.schema), [
        WALLET_TRANSACTION_COMPLETED_EVENT,
        payload,
      ]);

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
      const inserted = returnedRows<{ id: string | number; created_at: Date | string }>(
        await manager.query(
          `INSERT INTO ${this.ledgerTable}
             ("booking_id", "teacher_id", "amount_credits", "direction", "entry_type", "owner_id", "reference_id", "release_key", "trace_id")
           VALUES (NULL, $1, $2, 'credit', 'release', $1, $3, $4, $5)
           ON CONFLICT DO NOTHING
           RETURNING "id", "created_at"`,
          [
            request.teacherId,
            request.amountCredits,
            request.bookingId,
            request.releaseKey,
            request.traceId,
          ],
        ),
      );
      const releaseRow = inserted[0];
      if (releaseRow === undefined) {
        // The (booking, releaseKey) pair already released: a replayed `class.completed` lands
        // here and must stay silent, or every retry would tell the Teacher they were paid again.
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

      // B11 / FR-016: pending income became spendable and the Teacher was not told. Written in
      // this transaction, keyed on the inserted ledger id, and only when the release was actually
      // applied — an idempotent no-op above must not produce a second announcement.
      const occurredAt = (
        releaseRow.created_at instanceof Date
          ? releaseRow.created_at
          : new Date(releaseRow.created_at)
      ).toISOString();
      const payload = walletTransactionCompletedEventSchema.parse({
        transactionId: String(releaseRow.id),
        accountId: request.teacherId,
        type: 'income_release',
        amountCredits: request.amountCredits,
        direction: 'credit',
        occurredAt,
        bookingId: request.bookingId,
        actorId: request.actorId,
      });
      await manager.query(insertOutboxStatement(this.schema), [
        WALLET_TRANSACTION_COMPLETED_EVENT,
        payload,
      ]);

      return { applied: true };
    });
  }

  async refundBooking(request: RefundBookingRequest): Promise<RefundBookingResult> {
    const source = this.registry.get(this.moduleName);
    const { teacherCredits } = splitSettlement(request.priceCredits);
    return source.transaction(async (manager) => {
      // 1. Transaction-local advisory lock to serialize per booking
      await this.acquireBookingLock(manager, request.bookingId);

      // 2. Only a settled booking can be refunded; one refund per booking.
      const settled = (await manager.query(
        `SELECT 1 FROM ${this.ledgerTable} WHERE "entry_type" = 'learner_debit' AND "reference_id" = $1 LIMIT 1`,
        [request.bookingId],
      )) as unknown[];
      if (settled.length === 0) {
        return { applied: false };
      }
      const already = (await manager.query(
        `SELECT 1 FROM ${this.ledgerTable} WHERE "entry_type" = 'refund' AND "reference_id" = $1 LIMIT 1`,
        [request.bookingId],
      )) as unknown[];
      if (already.length > 0) {
        return { applied: false };
      }

      const inserted = await manager.query(
        `INSERT INTO ${this.ledgerTable}
           ("booking_id", "teacher_id", "amount_credits", "direction", "entry_type", "owner_id", "reference_id", "trace_id")
         VALUES (NULL, $1, $2, 'credit', 'refund', $1, $3, $4)
         RETURNING "id", "created_at"`,
        [request.learnerId, request.priceCredits, request.bookingId, request.traceId],
      );
      const refundRow = returnedRows<{ id: string | number; created_at: Date | string }>(inserted)[0];
      if (refundRow === undefined) {
        throw new Error('Failed to insert booking refund ledger entry');
      }
      await manager.query(
        `INSERT INTO ${this.table} ("owner_id", "available_credits", "updated_at")
         VALUES ($1, $2, now())
         ON CONFLICT ("owner_id") DO UPDATE
           SET "available_credits" = ${this.table}."available_credits" + $2, "updated_at" = now()`,
        [request.learnerId, request.priceCredits],
      );
      // Reverse the teacher's pending income (never below zero).
      await manager.query(
        `UPDATE ${this.table}
           SET "pending_credits" = GREATEST(0, "pending_credits" - $2), "updated_at" = now()
         WHERE "owner_id" = $1`,
        [request.teacherId, teacherCredits],
      );

      // B11 / FR-016: a refund moved the Learner's money and said nothing. The event is written
      // inside this transaction, with the inserted ledger row's id as `transactionId` — the same
      // durable identity `settleBooking` uses, so a consumer can follow the event back to the money
      // rather than to a guess. Parsed before the insert, so a payload that cannot satisfy the
      // contract fails here instead of becoming a dead letter after the credit has landed.
      const refundOccurredAt = (
        refundRow.created_at instanceof Date
          ? refundRow.created_at
          : new Date(refundRow.created_at)
      ).toISOString();
      const payload = walletTransactionCompletedEventSchema.parse({
        transactionId: String(refundRow.id),
        accountId: request.learnerId,
        type: 'booking_refund',
        amountCredits: request.priceCredits,
        direction: 'credit',
        occurredAt: refundOccurredAt,
        bookingId: request.bookingId,
        actorId: request.actorId,
      });
      await manager.query(insertOutboxStatement(this.schema), [
        WALLET_TRANSACTION_COMPLETED_EVENT,
        payload,
      ]);

      return { applied: true };
    });
  }
}
