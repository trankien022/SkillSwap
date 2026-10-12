import { EventHandlerRegistry } from '../../shared/messaging/event-handler-registry';
import { AccountProfileRegistrar } from './account-profile.module';
import type { NotificationManagementPort } from './internal/application/port/notification-management';

describe('AccountProfileRegistrar notification handlers', () => {
  it('persists verification, settled booking, cancellation and wallet inbox events idempotently', async () => {
    const registry = { register: jest.fn() } as never;
    const config = {} as never;
    const handlers = new EventHandlerRegistry();
    const projector = {} as never;
    const notificationManagement = { recordInboxNotification: jest.fn().mockResolvedValue(undefined) };
    new AccountProfileRegistrar(registry, config, handlers, projector, notificationManagement as unknown as NotificationManagementPort).onModuleInit();
    const handler = (queue: string) => handlers.list().find((item) => item.queue === queue)!.handler;
    await handler('account-profile.notification-student-verification-approved')({ id: 'e1', eventType: 'student.verification.approved', occurredAt: '2026-10-20T10:00:00.000Z', payload: { verificationId: 'v1', accountId: 'u1', status: 'approved', schoolName: 'A', reason: null, occurredAt: '2026-10-20T10:00:00.000Z' } });
    const beforePayment = notificationManagement.recordInboxNotification.mock.calls.length;
    await handler('account-profile.notification-booking-confirmed')({ id: 'e2', eventType: 'booking.confirmed', occurredAt: '2026-10-20T10:00:00.000Z', payload: { bookingId: 'b1', studentId: 'u1', teacherId: 'u2', amountCredits: 50 } });
    expect(notificationManagement.recordInboxNotification).toHaveBeenCalledTimes(beforePayment);
    await handler('account-profile.notification-booking-confirmed')({ id: 'e3', eventType: 'booking.confirmed', occurredAt: '2026-10-20T10:00:00.000Z', payload: { bookingId: 'b1', studentId: 'u1', teacherId: 'u2', amountCredits: 50, settled: true, classId: 'c1' } });
    expect(notificationManagement.recordInboxNotification).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e3', accountId: 'u2', type: 'booking_confirmed', targetId: 'b1' }));
    await handler('account-profile.notification-booking-cancelled')({ id: 'e4', eventType: 'booking.cancelled', occurredAt: '2026-10-20T10:00:00.000Z', payload: { bookingId: 'b2', classId: 'c1', learnerId: 'u1', teacherId: 'u2', priceCredits: 10, reason: 'class_cancelled' } });
    await handler('account-profile.notification-wallet-completed')({ id: 'e5', eventType: 'wallet.transaction.completed', occurredAt: '2026-10-20T10:00:00.000Z', payload: { transactionId: 'tx1', accountId: 'u1', type: 'top_up', amountCredits: 5, direction: 'credit', occurredAt: '2026-10-20T10:00:00.000Z' } });
    expect(notificationManagement.recordInboxNotification).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'u1', type: 'booking_cancelled', targetId: 'b2' }));
    expect(notificationManagement.recordInboxNotification).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'u1', type: 'wallet_transaction', targetId: 'tx1' }));
  });
});
