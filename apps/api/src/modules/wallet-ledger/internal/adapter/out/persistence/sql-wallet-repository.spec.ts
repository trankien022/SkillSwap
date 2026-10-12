import { SqlWalletRepository } from './sql-wallet-repository';
import { InsufficientBalanceError } from '../../../domain/wallet';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import type {
  RefundBookingRequest,
  SettleBookingRequest,
} from '../../../application/port/out/wallet-repository';
import type { WalletTransactionCompletedEvent } from '@skillswap/contracts';

interface RecordedQuery {
  sql: string;
  params?: unknown[];
}

interface TransactionState {
  committed: boolean;
  rolledBack: boolean;
}

interface TestHarness {
  readonly registry: ModuleDataSourceRegistry;
  readonly recordedQueries: readonly RecordedQuery[];
  readonly txState: TransactionState;
  readonly transactionCommitted: boolean;
  readonly transactionRolledBack: boolean;
}

function createQueueRegistry(responses: unknown[]): TestHarness {
  const recordedQueries: RecordedQuery[] = [];
  const queue = [...responses];
  const txState: TransactionState = {
    committed: false,
    rolledBack: false,
  };

  const mockQuery = jest.fn(async (sql: string, params?: unknown[]) => {
    recordedQueries.push({ sql, params });
    if (queue.length === 0) {
      throw new Error(`Unexpected query: ${sql} with params ${JSON.stringify(params)}`);
    }
    const next = queue.shift();
    if (typeof next === 'function') {
      return next(sql, params);
    }
    if (next instanceof Error) {
      throw next;
    }
    return next;
  });

  const manager = {
    query: mockQuery,
  };

  const dataSource = {
    query: mockQuery,
    transaction: jest.fn(async <T>(cb: (mgr: typeof manager) => Promise<T>): Promise<T> => {
      try {
        const result = await cb(manager);
        txState.committed = true;
        return result;
      } catch (err) {
        txState.rolledBack = true;
        throw err;
      }
    }),
  };

  const registry = {
    getSchema: jest.fn(() => 'wallet_ledger'),
    get: jest.fn(() => dataSource),
  } as unknown as ModuleDataSourceRegistry;

  return {
    registry,
    recordedQueries,
    txState,
    get transactionCommitted() {
      return txState.committed;
    },
    get transactionRolledBack() {
      return txState.rolledBack;
    },
  };
}

const NOW = new Date('2026-10-12T03:00:00.000Z');

const sampleSettleRequest: SettleBookingRequest = {
  bookingId: 'bk-100',
  learnerId: 'learner-1',
  teacherId: 'teacher-1',
  priceCredits: 100,
  teacherCredits: 90,
  platformFeeCredits: 10,
  traceId: 'trace-settle-1',
};

const sampleRefundRequest: RefundBookingRequest = {
  bookingId: 'bk-100',
  learnerId: 'learner-1',
  teacherId: 'teacher-1',
  priceCredits: 100,
  traceId: 'trace-refund-1',
};

describe('SqlWalletRepository (ADR-032 / Phase C2)', () => {
  describe('settleBooking', () => {
    it('executes successful settlement with durable identity and atomic outbox outcome', async () => {
      const harness = createQueueRegistry([
        [], // 1. Advisory lock
        [], // 2. Check existing learner_debit (none)
        [[{ available_credits: 900 }], 1], // 3. Debit learner balance [rows, rowCount]
        [{ id: '101', created_at: NOW }], // 4. Insert learner_debit RETURNING id, created_at
        [], // 5. Insert teacher_pending ledger
        [], // 6. Insert platform_fee ledger
        [], // 7. Update teacher wallet pending balance
        [{ id: 'outbox-uuid-1' }], // 8. Insert outbox message
      ]);

      const repo = new SqlWalletRepository(harness.registry, 'wallet-ledger');
      const result = await repo.settleBooking(sampleSettleRequest);

      expect(result).toEqual({
        applied: true,
        teacherCredits: 90,
        platformFeeCredits: 10,
      });
      expect(harness.txState.committed).toBe(true);

      // Verify query sequence
      expect(harness.recordedQueries).toHaveLength(8);

      // 1. Advisory lock serialized per booking
      expect(harness.recordedQueries[0].sql).toContain('pg_advisory_xact_lock(hashtext($1))');
      expect(harness.recordedQueries[0].params).toEqual(['wallet_booking:bk-100']);

      // 2. Existence check before debit
      expect(harness.recordedQueries[1].sql).toContain(
        'WHERE "entry_type" = \'learner_debit\' AND "reference_id" = $1 LIMIT 1',
      );
      expect(harness.recordedQueries[1].params).toEqual(['bk-100']);

      // 3. Balance debit
      expect(harness.recordedQueries[2].sql).toContain('UPDATE "wallet_ledger"."wallets"');
      expect(harness.recordedQueries[2].params).toEqual(['learner-1', 100]);

      // 4. Learner debit ledger insert with RETURNING
      expect(harness.recordedQueries[3].sql).toContain('INSERT INTO "wallet_ledger"."ledger_entries"');
      expect(harness.recordedQueries[3].sql).toContain('RETURNING "id", "created_at"');
      expect(harness.recordedQueries[3].params).toEqual([
        'learner-1',
        100,
        'debit',
        'learner_debit',
        'bk-100',
        'trace-settle-1',
      ]);

      // 8. Outbox message emission with durable identity
      expect(harness.recordedQueries[7].sql).toContain('INSERT INTO "wallet_ledger"."outbox_messages"');
      expect(harness.recordedQueries[7].params?.[0]).toBe('wallet.transaction.completed');

      const payload = harness.recordedQueries[7].params?.[1] as WalletTransactionCompletedEvent;
      expect(payload).toEqual({
        transactionId: '101', // durable identity from persisted ledger entry id
        accountId: 'learner-1',
        type: 'booking_payment',
        amountCredits: 100,
        direction: 'debit',
        occurredAt: NOW.toISOString(), // durable timestamp from persisted created_at
        bookingId: 'bk-100',
      });
    });

    it('skips zero platform_fee ledger insert for price 1 credit while preserving positive learner debit, teacher pending, and completed outcome', async () => {
      const price1Request: SettleBookingRequest = {
        bookingId: 'bk-price-1',
        learnerId: 'learner-1',
        teacherId: 'teacher-1',
        priceCredits: 1,
        teacherCredits: 1,
        platformFeeCredits: 0,
        traceId: 'trace-price-1',
      };

      const harness = createQueueRegistry([
        [], // 1. Advisory lock
        [], // 2. Check existing learner_debit (none)
        [[{ available_credits: 999 }], 1], // 3. Debit learner balance [rows, rowCount]
        [{ id: '301', created_at: NOW }], // 4. Insert learner_debit RETURNING id, created_at
        [], // 5. Insert teacher_pending ledger
        // Note: platform_fee insert is SKIPPED because platformFeeCredits is 0
        [], // 6. Update teacher wallet pending balance
        [{ id: 'outbox-uuid-p1' }], // 7. Insert outbox message
      ]);

      const repo = new SqlWalletRepository(harness.registry, 'wallet-ledger');
      const result = await repo.settleBooking(price1Request);

      expect(result).toEqual({
        applied: true,
        teacherCredits: 1,
        platformFeeCredits: 0,
      });
      expect(harness.txState.committed).toBe(true);

      // Exactly 7 queries executed (platform_fee insert skipped)
      expect(harness.recordedQueries).toHaveLength(7);

      // Verify no zero ledger insert was attempted
      const insertedFeeQueries = harness.recordedQueries.filter((q) =>
        q.sql.includes('platform_fee'),
      );
      expect(insertedFeeQueries).toHaveLength(0);

      // Learner debit was inserted with amount 1
      expect(harness.recordedQueries[3].params).toEqual([
        'learner-1',
        1,
        'debit',
        'learner_debit',
        'bk-price-1',
        'trace-price-1',
      ]);

      // Teacher pending was inserted with amount 1
      expect(harness.recordedQueries[4].params).toEqual([
        'teacher-1',
        1,
        'credit',
        'teacher_pending',
        'bk-price-1',
        'trace-price-1',
      ]);

      // Teacher wallet pending balance updated with amount 1
      expect(harness.recordedQueries[5].params).toEqual(['teacher-1', 1]);

      // Completed outcome emitted for positive price 1
      const payload = harness.recordedQueries[6].params?.[1] as WalletTransactionCompletedEvent;
      expect(payload).toEqual({
        transactionId: '301',
        accountId: 'learner-1',
        type: 'booking_payment',
        amountCredits: 1,
        direction: 'debit',
        occurredAt: NOW.toISOString(),
        bookingId: 'bk-price-1',
      });
    });

    it('replays existing settlement, ensuring missing outcome once without debiting balance', async () => {
      const existingDebitRow = {
        id: '101',
        owner_id: 'learner-1',
        amount_credits: 100,
        created_at: NOW,
      };

      const harness = createQueueRegistry([
        [], // 1. Advisory lock
        [existingDebitRow], // 2. Found existing learner_debit
        [], // 3. Check outbox messages (none found / missing outcome)
        [{ id: 'outbox-uuid-2' }], // 4. Insert canonical outbox event
      ]);

      const repo = new SqlWalletRepository(harness.registry, 'wallet-ledger');
      const result = await repo.settleBooking(sampleSettleRequest);

      expect(result).toEqual({
        applied: false,
        teacherCredits: 90,
        platformFeeCredits: 10,
      });
      expect(harness.txState.committed).toBe(true);

      // Verify no balance update or ledger inserts occurred
      expect(harness.recordedQueries).toHaveLength(4);
      expect(harness.recordedQueries[1].sql).toContain(
        'SELECT "id", "owner_id", "amount_credits", "created_at"',
      );

      // Outbox check verified by event_type, transactionId and bookingId
      expect(harness.recordedQueries[2].sql).toContain('FROM "wallet_ledger"."outbox_messages"');
      expect(harness.recordedQueries[2].sql).toContain('"payload"->>\'transactionId\' = $2');
      expect(harness.recordedQueries[2].params).toEqual([
        'wallet.transaction.completed',
        '101',
        'bk-100',
      ]);

      // Missing outbox created with durable identity
      expect(harness.recordedQueries[3].sql).toContain('INSERT INTO "wallet_ledger"."outbox_messages"');
      const payload = harness.recordedQueries[3].params?.[1] as WalletTransactionCompletedEvent;
      expect(payload).toEqual({
        transactionId: '101',
        accountId: 'learner-1',
        type: 'booking_payment',
        amountCredits: 100,
        direction: 'debit',
        occurredAt: NOW.toISOString(),
        bookingId: 'bk-100',
      });
    });

    it('does not duplicate outbox event on replay when outcome already exists (even if published or dead)', async () => {
      const existingDebitRow = {
        id: '101',
        owner_id: 'learner-1',
        amount_credits: 100,
        created_at: NOW,
      };

      const harness = createQueueRegistry([
        [], // 1. Advisory lock
        [existingDebitRow], // 2. Found existing learner_debit
        [{ id: 'existing-outbox-uuid' }], // 3. Found existing outbox row (published/dead/pending)
      ]);

      const repo = new SqlWalletRepository(harness.registry, 'wallet-ledger');
      const result = await repo.settleBooking(sampleSettleRequest);

      expect(result).toEqual({
        applied: false,
        teacherCredits: 90,
        platformFeeCredits: 10,
      });
      expect(harness.txState.committed).toBe(true);

      // Advisory lock, replay check, and outbox existence check only
      expect(harness.recordedQueries).toHaveLength(3);
    });

    it('rolls back transaction with zero writes and zero outcome when learner balance is insufficient', async () => {
      const harness = createQueueRegistry([
        [], // 1. Advisory lock
        [], // 2. Replay check: no existing debit
        [[], 0], // 3. Balance UPDATE returns 0 rows [rows, rowCount]
        [{ available_credits: 40 }], // 4. SELECT available_credits for error detail
      ]);

      const repo = new SqlWalletRepository(harness.registry, 'wallet-ledger');
      await expect(repo.settleBooking(sampleSettleRequest)).rejects.toThrow(
        InsufficientBalanceError,
      );

      expect(harness.txState.rolledBack).toBe(true);
      // Ensure no ledger rows and no outbox writes occurred
      expect(harness.recordedQueries).toHaveLength(4);
      expect(harness.recordedQueries[2].sql).toContain('UPDATE "wallet_ledger"."wallets"');
      expect(harness.recordedQueries[3].sql).toContain(
        'SELECT "available_credits" FROM "wallet_ledger"."wallets"',
      );
    });

    it('rolls back transaction when learner debit row insert returns no row', async () => {
      const harness = createQueueRegistry([
        [], // 1. Advisory lock
        [], // 2. Replay check: no existing debit
        [[{ available_credits: 900 }], 1], // 3. Balance UPDATE [rows, rowCount]
        [], // 4. Insert learner_debit returns 0 rows
      ]);

      const repo = new SqlWalletRepository(harness.registry, 'wallet-ledger');
      await expect(repo.settleBooking(sampleSettleRequest)).rejects.toThrow(
        'Failed to insert learner debit ledger entry',
      );

      expect(harness.txState.rolledBack).toBe(true);
      expect(harness.recordedQueries).toHaveLength(4);
    });

    it('propagates outbox write failure across transaction rollback boundary', async () => {
      const outboxError = new Error('Disk full: unable to append outbox record');
      const harness = createQueueRegistry([
        [], // 1. Advisory lock
        [], // 2. Replay check: no existing debit
        [[{ available_credits: 900 }], 1], // 3. Balance UPDATE [rows, rowCount]
        [{ id: '101', created_at: NOW }], // 4. Insert learner_debit
        [], // 5. Insert teacher_pending
        [], // 6. Insert platform_fee
        [], // 7. Update teacher wallet
        outboxError, // 8. Outbox write fails!
      ]);

      const repo = new SqlWalletRepository(harness.registry, 'wallet-ledger');
      await expect(repo.settleBooking(sampleSettleRequest)).rejects.toBe(outboxError);

      expect(harness.txState.rolledBack).toBe(true);
      expect(harness.recordedQueries).toHaveLength(8);
    });

    it('rejects conflicting replay with different learner without privacy disclosure', async () => {
      const conflictingDebitRow = {
        id: '101',
        owner_id: 'other-learner-secret-id',
        amount_credits: 100,
        created_at: NOW,
      };

      const harness = createQueueRegistry([
        [], // 1. Advisory lock
        [conflictingDebitRow], // 2. Found debit belonging to different learner
      ]);

      const repo = new SqlWalletRepository(harness.registry, 'wallet-ledger');
      try {
        await repo.settleBooking(sampleSettleRequest);
        throw new Error('Expected conflict error');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(Error);
        const error = err as Error;
        expect(error.message).toContain('Settlement request does not match');
        expect(error.message).not.toContain('other-learner-secret-id');
      }

      expect(harness.txState.rolledBack).toBe(true);
      expect(harness.recordedQueries).toHaveLength(2);
    });

    it('rejects conflicting replay with different amount without privacy disclosure', async () => {
      const conflictingDebitRow = {
        id: '101',
        owner_id: 'learner-1',
        amount_credits: 9999,
        created_at: NOW,
      };

      const harness = createQueueRegistry([
        [], // 1. Advisory lock
        [conflictingDebitRow], // 2. Found debit with different amount
      ]);

      const repo = new SqlWalletRepository(harness.registry, 'wallet-ledger');
      try {
        await repo.settleBooking(sampleSettleRequest);
        throw new Error('Expected conflict error');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(Error);
        const error = err as Error;
        expect(error.message).toContain('Settlement request does not match');
        expect(error.message).not.toContain('9999');
      }

      expect(harness.txState.rolledBack).toBe(true);
      expect(harness.recordedQueries).toHaveLength(2);
    });
  });

  describe('refundBooking', () => {
    it('serializes with same advisory lock, verifies settlement, and inserts refund with credit direction', async () => {
      const harness = createQueueRegistry([
        [], // 1. Advisory lock
        [{ 1: 1 }], // 2. Check settled (found learner_debit)
        [], // 3. Check already refunded (none)
        [], // 4. Insert refund ledger entry
        [], // 5. Credit learner balance
        [], // 6. Reverse teacher pending balance
      ]);

      const repo = new SqlWalletRepository(harness.registry, 'wallet-ledger');
      const result = await repo.refundBooking(sampleRefundRequest);

      expect(result).toEqual({ applied: true });
      expect(harness.txState.committed).toBe(true);

      expect(harness.recordedQueries).toHaveLength(6);

      // 1. Advisory lock uses exact same namespace string as settleBooking
      expect(harness.recordedQueries[0].sql).toContain('pg_advisory_xact_lock(hashtext($1))');
      expect(harness.recordedQueries[0].params).toEqual(['wallet_booking:bk-100']);

      // 4. Direction is 'credit', not 'debit'
      expect(harness.recordedQueries[3].sql).toContain('INSERT INTO "wallet_ledger"."ledger_entries"');
      expect(harness.recordedQueries[3].sql).toContain('\'credit\', \'refund\'');
      expect(harness.recordedQueries[3].params).toEqual([
        'learner-1',
        100,
        'bk-100',
        'trace-refund-1',
      ]);

      // 5. Learner available balance credited
      expect(harness.recordedQueries[4].sql).toContain(
        '"available_credits" = "wallet_ledger"."wallets"."available_credits" + $2',
      );
      expect(harness.recordedQueries[4].params).toEqual(['learner-1', 100]);

      // 6. Teacher pending balance decremented (never below zero)
      expect(harness.recordedQueries[5].sql).toContain('GREATEST(0, "pending_credits" - $2)');
      expect(harness.recordedQueries[5].params).toEqual(['teacher-1', 90]);
    });

    it('returns applied=false without writes when booking was never settled', async () => {
      const harness = createQueueRegistry([
        [], // 1. Advisory lock
        [], // 2. Check settled returns empty
      ]);

      const repo = new SqlWalletRepository(harness.registry, 'wallet-ledger');
      const result = await repo.refundBooking(sampleRefundRequest);

      expect(result).toEqual({ applied: false });
      expect(harness.txState.committed).toBe(true);
      expect(harness.recordedQueries).toHaveLength(2);
    });

    it('returns applied=false without writes when booking was already refunded', async () => {
      const harness = createQueueRegistry([
        [], // 1. Advisory lock
        [{ 1: 1 }], // 2. Check settled returns match
        [{ 1: 1 }], // 3. Check already refunded returns match
      ]);

      const repo = new SqlWalletRepository(harness.registry, 'wallet-ledger');
      const result = await repo.refundBooking(sampleRefundRequest);

      expect(result).toEqual({ applied: false });
      expect(harness.txState.committed).toBe(true);
      expect(harness.recordedQueries).toHaveLength(3);
    });
  });

  describe('Advisory serialization parity between settle and refund', () => {
    it('uses the exact same advisory lock query and namespace for settleBooking and refundBooking', async () => {
      const settleHarness = createQueueRegistry([
        [], // Advisory lock
        [], // Check debit
        [[{ available_credits: 900 }], 1], // [rows, rowCount]
        [{ id: '200', created_at: NOW }],
        [], [], [], [{ id: 'out-1' }],
      ]);
      const refundHarness = createQueueRegistry([
        [], // Advisory lock
        [], // Check settled -> false
      ]);

      const settleRepo = new SqlWalletRepository(settleHarness.registry, 'wallet-ledger');
      const refundRepo = new SqlWalletRepository(refundHarness.registry, 'wallet-ledger');

      await settleRepo.settleBooking({ ...sampleSettleRequest, bookingId: 'bk-serialize-test' });
      await refundRepo.refundBooking({ ...sampleRefundRequest, bookingId: 'bk-serialize-test' });

      expect(settleHarness.txState.committed).toBe(true);
      expect(refundHarness.txState.committed).toBe(true);

      const settleLockQuery = settleHarness.recordedQueries[0];
      const refundLockQuery = refundHarness.recordedQueries[0];

      expect(settleLockQuery.sql).toBe(refundLockQuery.sql);
      expect(settleLockQuery.params).toEqual(['wallet_booking:bk-serialize-test']);
      expect(refundLockQuery.params).toEqual(['wallet_booking:bk-serialize-test']);
    });
  });
});
