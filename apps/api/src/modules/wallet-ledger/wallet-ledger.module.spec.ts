import { WalletLedgerRegistrar } from './wallet-ledger.module';
import { EventHandlerRegistry, type BusMessage } from '../../shared/messaging/event-handler-registry';
import type { ModuleDataSourceRegistry } from '../../shared/messaging/module-registry';
import type { ApiConfig } from '../../shared/config/api-config';
import type { RecordBookingConfirmedPort } from './internal/application/port/in/record-booking-confirmed';
import type { RefundCancelledBookingPort } from './internal/application/port/in/refund-cancelled-booking';
import type { ReleaseCompletedClassPort } from './internal/application/port/in/release-completed-class';

describe('WalletLedgerRegistrar (ADR-032 / Phase C2)', () => {
  function setup() {
    const handlers = new EventHandlerRegistry();
    const recordBooking: RecordBookingConfirmedPort = {
      execute: jest.fn().mockResolvedValue({
        applied: true,
        teacherCredits: 90,
        platformFeeCredits: 10,
      }),
    };
    const refundBooking: RefundCancelledBookingPort = {
      execute: jest.fn().mockResolvedValue({ applied: true }),
    };
    const releaseClass: ReleaseCompletedClassPort = {
      execute: jest.fn().mockResolvedValue({ releasedBookings: 1 }),
    };
    const registry = {
      register: jest.fn(),
    } as unknown as ModuleDataSourceRegistry;
    const config = {} as unknown as ApiConfig;

    const registrar = new WalletLedgerRegistrar(
      registry,
      config,
      handlers,
      recordBooking,
      refundBooking,
      releaseClass,
    );

    registrar.onModuleInit();

    const bookingConfirmedHandler = handlers
      .list()
      .find((r) => r.eventType === 'booking.confirmed')?.handler;

    if (!bookingConfirmedHandler) {
      throw new Error('booking.confirmed handler was not registered');
    }

    return {
      handlers,
      recordBooking,
      refundBooking,
      releaseClass,
      bookingConfirmedHandler,
    };
  }

  it('processes legacy booking.confirmed request where settled defaults to false', async () => {
    const { bookingConfirmedHandler, recordBooking } = setup();

    const message: BusMessage = {
      id: 'msg-legacy-1',
      eventType: 'booking.confirmed',
      occurredAt: '2026-10-12T03:00:00.000Z',
      payload: {
        bookingId: 'bk-100',
        studentId: 'std-200',
        teacherId: 'tch-300',
        amountCredits: 100,
      },
    };

    await bookingConfirmedHandler(message);

    expect(recordBooking.execute).toHaveBeenCalledTimes(1);
    expect(recordBooking.execute).toHaveBeenCalledWith({
      bookingId: 'bk-100',
      studentId: 'std-200',
      teacherId: 'tch-300',
      amountCredits: 100,
      settled: false,
    });
  });

  it('processes explicit booking.confirmed request with settled=false', async () => {
    const { bookingConfirmedHandler, recordBooking } = setup();

    const message: BusMessage = {
      id: 'msg-req-2',
      eventType: 'booking.confirmed',
      occurredAt: '2026-10-12T03:00:00.000Z',
      payload: {
        bookingId: 'bk-101',
        studentId: 'std-201',
        teacherId: 'tch-301',
        amountCredits: 250,
        settled: false,
        classId: 'cls-500',
      },
    };

    await bookingConfirmedHandler(message);

    expect(recordBooking.execute).toHaveBeenCalledTimes(1);
    expect(recordBooking.execute).toHaveBeenCalledWith({
      bookingId: 'bk-101',
      studentId: 'std-201',
      teacherId: 'tch-301',
      amountCredits: 250,
      settled: false,
      classId: 'cls-500',
    });
  });

  it('ignores authoritative final settled=true event to prevent double debit and endless loops', async () => {
    const { bookingConfirmedHandler, recordBooking } = setup();

    const message: BusMessage = {
      id: 'msg-final-3',
      eventType: 'booking.confirmed',
      occurredAt: '2026-10-12T03:00:00.000Z',
      payload: {
        bookingId: 'bk-102',
        studentId: 'std-202',
        teacherId: 'tch-302',
        amountCredits: 100,
        settled: true,
        classId: 'cls-999',
      },
    };

    await bookingConfirmedHandler(message);

    expect(recordBooking.execute).not.toHaveBeenCalled();
  });

  it('fails contract parsing when settled=true event is missing required classId', async () => {
    const { bookingConfirmedHandler, recordBooking } = setup();

    const invalidMessage: BusMessage = {
      id: 'msg-invalid-4',
      eventType: 'booking.confirmed',
      occurredAt: '2026-10-12T03:00:00.000Z',
      payload: {
        bookingId: 'bk-103',
        studentId: 'std-203',
        teacherId: 'tch-303',
        amountCredits: 100,
        settled: true,
      },
    };

    await expect(bookingConfirmedHandler(invalidMessage)).rejects.toThrow(
      /classId is required and non-empty when settled is true/,
    );
    expect(recordBooking.execute).not.toHaveBeenCalled();
  });
});
