import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { SqlBookingPaymentRepository } from './sql-booking-payment-repository';
import type { RecordBookingPaymentCommand } from '../../../application/port/in/record-booking-payment';

interface QueryCall { readonly sql: string; readonly params: unknown[] | undefined; }
interface QueryManager { query(sql: string, params?: unknown[]): Promise<unknown>; }
interface BookingRow { readonly id: string; readonly class_id: string; readonly learner_id: string; readonly state: string; readonly price_credits: number; readonly expires_at: Date | null; readonly cancel_reason: string | null; readonly hold_active: boolean; }
const command: RecordBookingPaymentCommand = { transactionId: 'wallet-ledger-transaction-101', bookingId: 'booking-101', accountId: 'learner-1', amountCredits: 100, occurredAt: '2026-10-12T03:00:00.000Z' };
const pendingBooking: BookingRow = { id: 'booking-101', class_id: 'class-1', learner_id: 'learner-1', state: 'pending', price_credits: 100, expires_at: new Date('2026-10-12T03:15:00.000Z'), cancel_reason: null, hold_active: true };
const classRow = { id: 'class-1', teacher_id: 'teacher-1', state: 'published' };
function createHarness(responses: unknown[]) {
  const queue = [...responses]; const calls: QueryCall[] = []; let committed = false; let rolledBack = false;
  const manager: QueryManager = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (!queue.length) throw new Error('Unexpected query');
      const result = queue.shift();
      if (result instanceof Error) throw result;
      return result;
    }),
  };
  const dataSource = {
    transaction: jest.fn(async <T>(execute: (manager: QueryManager) => Promise<T>): Promise<T> => {
      try {
        const result = await execute(manager);
        committed = true;
        return result;
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    }),
  };
  const registry = { getSchema: jest.fn(() => 'live_class'), get: jest.fn(() => dataSource) } as unknown as ModuleDataSourceRegistry;
  return { repository: new SqlBookingPaymentRepository(registry, 'live-class'), calls, committed: () => committed, rolledBack: () => rolledBack };
}
function lookupResponses(booking: BookingRow = pendingBooking, state = classRow.state) { return [[{ class_id: booking.class_id }], [{ ...classRow, state }], [booking]]; }
describe('SqlBookingPaymentRepository (ADR-032)', () => {
  it('confirms an eligible pending booking with an atomic logical receipt and final event', async () => {
    const confirmed = { ...pendingBooking, state: 'confirmed', expires_at: null };
    const harness = createHarness([...lookupResponses(), [{ id: `booking-payment:${command.transactionId}` }], [[confirmed], 1], []]);
    await expect(harness.repository.applySuccessfulPayment(command)).resolves.toEqual({ disposition: 'confirmed' });
    expect(harness.committed()).toBe(true); expect(harness.calls[1]?.sql).toContain('FOR UPDATE'); expect(harness.calls[2]?.sql).toContain('FOR UPDATE'); expect(harness.calls[3]?.sql).toContain('ON CONFLICT ("id") DO NOTHING');
    expect(harness.calls[5]?.params).toEqual(['booking.confirmed', { bookingId: 'booking-101', classId: 'class-1', studentId: 'learner-1', teacherId: 'teacher-1', amountCredits: 100, settled: true }]);
    expect(harness.calls.some(call => /wallet_ledger|wallet_transactions/.test(call.sql))).toBe(false);
  });
  it('deduplicates the persisted transaction across distinct broker envelope ids', async () => { const harness = createHarness([...lookupResponses(), []]); await expect(harness.repository.applySuccessfulPayment(command)).resolves.toEqual({ disposition: 'duplicate' }); expect(harness.calls).toHaveLength(4); expect(harness.committed()).toBe(true); });
  it.each([['wrong account', { ...command, accountId: 'another-learner' }], ['wrong amount', { ...command, amountCredits: 99 }]])('rejects %s before receipt or effects', async (_label, mismatch) => { const harness = createHarness(lookupResponses()); await expect(harness.repository.applySuccessfulPayment(mismatch)).rejects.toThrow('Wallet payment outcome does not match a local booking'); expect(harness.calls).toHaveLength(3); expect(harness.rolledBack()).toBe(true); });
  it('cancels an expired pending hold and emits late payment compensation', async () => { const expired = { ...pendingBooking, hold_active: false }; const cancelled = { ...expired, state: 'cancelled', cancel_reason: 'expired' }; const harness = createHarness([...lookupResponses(expired), [{ id: 'receipt' }], [[cancelled], 1], []]); await expect(harness.repository.applySuccessfulPayment(command)).resolves.toEqual({ disposition: 'compensated' }); expect(harness.calls[4]?.params).toEqual(['booking-101', 'expired']); expect(harness.calls[5]?.params?.[0]).toBe('booking.cancelled'); });
  it('compensates a debit for a cancelled class', async () => { const cancelled = { ...pendingBooking, state: 'cancelled', cancel_reason: 'class_cancelled' }; const harness = createHarness([...lookupResponses(pendingBooking, 'cancelled'), [{ id: 'receipt' }], [[cancelled], 1], []]); await expect(harness.repository.applySuccessfulPayment(command)).resolves.toEqual({ disposition: 'compensated' }); expect(harness.calls[4]?.params).toEqual(['booking-101', 'class_cancelled']); expect(harness.calls[5]?.params?.[0]).toBe('booking.cancelled'); });
  it('emits compensation even when the earlier cancellation event preceded payment', async () => { const cancelled: BookingRow = { ...pendingBooking, state: 'cancelled', cancel_reason: 'class_cancelled' }; const harness = createHarness([...lookupResponses(cancelled), [{ id: 'receipt' }], []]); await expect(harness.repository.applySuccessfulPayment(command)).resolves.toEqual({ disposition: 'compensated' }); expect(harness.calls).toHaveLength(5); expect(harness.calls[4]?.params?.[0]).toBe('booking.cancelled'); });
  it.each(['confirmed', 'completed', 'disputed'])('does not refund a legitimate %s booking', async state => { const harness = createHarness([...lookupResponses({ ...pendingBooking, state }), [{ id: 'receipt' }]]); await expect(harness.repository.applySuccessfulPayment(command)).resolves.toEqual({ disposition: 'ignored' }); expect(harness.calls).toHaveLength(4); });
  it('rolls back its logical receipt and state change when final outbox insertion fails', async () => { const harness = createHarness([...lookupResponses(), [{ id: `booking-payment:${command.transactionId}` }], [[{ ...pendingBooking, state: 'confirmed', expires_at: null }], 1], new Error('outbox unavailable')]); await expect(harness.repository.applySuccessfulPayment(command)).rejects.toThrow('outbox unavailable'); expect(harness.rolledBack()).toBe(true); expect(harness.committed()).toBe(false); });
});
