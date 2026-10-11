import { EventHandlerRegistry } from '../../shared/messaging/event-handler-registry';
import { PermanentHandlerError } from '../../shared/errors';
import {
  BookingPaymentMismatchError,
  type RecordBookingPaymentPort,
} from './internal/application/port/in/record-booking-payment';
import type { ModuleDataSourceRegistry } from '../../shared/messaging/module-registry';
import type { ApiConfig } from '../../shared/config/api-config';
import type { SqlTeacherTrustProjector } from './internal/adapter/out/persistence/sql-teacher-trust-projector';
import { LiveClassRegistrar } from './live-class.module';

describe('LiveClassRegistrar wallet outcome handler (ADR-032)', () => {
  function setup(execute: RecordBookingPaymentPort['execute']) {
    const registry = new EventHandlerRegistry();
    const record = { execute } satisfies RecordBookingPaymentPort;
    const dataSources = {
      register: jest.fn(),
    } as unknown as ModuleDataSourceRegistry;
    const registrar = new LiveClassRegistrar(
      dataSources,
      {} as ApiConfig,
      registry,
      {} as SqlTeacherTrustProjector,
      record,
    );
    registrar.onModuleInit();
    const handler = registry
      .list()
      .find((entry) => entry.eventType === 'wallet.transaction.completed');
    if (!handler) throw new Error('Missing wallet outcome registration');
    return { handler: handler.handler, record };
  }

  const envelope = (payload: unknown) => ({
    id: 'envelope-1',
    eventType: 'wallet.transaction.completed',
    occurredAt: '2026-10-12T03:00:00.000Z',
    payload,
  });

  it('routes a correlated successful booking debit to the outcome use case', async () => {
    const record = { execute: jest.fn(async () => ({ disposition: 'confirmed' as const })) };
    const { handler } = setup(record.execute);
    await handler(envelope({
      transactionId: 'wallet-ledger-tx-1',
      accountId: 'learner-1',
      type: 'booking_payment',
      amountCredits: 100,
      direction: 'debit',
      occurredAt: '2026-10-12T03:00:00.000Z',
      bookingId: 'booking-1',
    }));
    expect(record.execute).toHaveBeenCalledWith({
      transactionId: 'wallet-ledger-tx-1',
      bookingId: 'booking-1',
      accountId: 'learner-1',
      amountCredits: 100,
      occurredAt: '2026-10-12T03:00:00.000Z',
    });
  });

  it('ignores approved non-booking completion types', async () => {
    const record = { execute: jest.fn() };
    const { handler } = setup(record.execute);
    await handler(envelope({
      transactionId: 'wallet-top-up-1',
      accountId: 'learner-1',
      type: 'top_up',
      amountCredits: 100,
      direction: 'credit',
      occurredAt: '2026-10-12T03:00:00.000Z',
    }));
    expect(record.execute).not.toHaveBeenCalled();
  });

  it('marks a mismatched booking identity permanent and lets infrastructure failures retry', async () => {
    const { handler: mismatchHandler } = setup(async () => {
      throw new BookingPaymentMismatchError();
    });
    const event = envelope({
      transactionId: 'wallet-ledger-tx-1',
      accountId: 'learner-1',
      type: 'booking_payment',
      amountCredits: 100,
      direction: 'debit',
      occurredAt: '2026-10-12T03:00:00.000Z',
      bookingId: 'booking-1',
    });
    await expect(mismatchHandler(event)).rejects.toBeInstanceOf(PermanentHandlerError);

    const databaseDown = new Error('database unavailable');
    const { handler: failingHandler } = setup(async () => {
      throw databaseDown;
    });
    await expect(failingHandler(event)).rejects.toBe(databaseDown);
  });
});
