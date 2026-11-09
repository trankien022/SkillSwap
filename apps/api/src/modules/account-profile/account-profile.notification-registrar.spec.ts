import { EventHandlerRegistry } from '../../shared/messaging/event-handler-registry';
import { AccountProfileRegistrar } from './account-profile.module';
import type { NotificationManagementPort } from './internal/application/port/notification-management';

// ADR-035: the actor the emitter would record. These consumers do not read it.
const ACTOR = '8a1e0000-0000-4000-8000-000000000b04';

describe('AccountProfileRegistrar notification handlers', () => {
  it('persists verification, settled booking, cancellation and wallet inbox events idempotently', async () => {
    const registry = { register: jest.fn() } as never;
    const config = {} as never;
    const handlers = new EventHandlerRegistry();
    const projector = { upsert: jest.fn().mockResolvedValue(undefined) } as never;
    const notificationManagement = { recordInboxNotification: jest.fn().mockResolvedValue(undefined) };
    new AccountProfileRegistrar(registry, config, handlers, projector, notificationManagement as unknown as NotificationManagementPort).onModuleInit();
    // ADR-013 Amendment B: one queue, so a verification event now has two handlers on it — the
    // status projection and the inbox notification. This suite is about the notification, which
    // is registered second.
    const handler = (eventType: string) =>
      handlers.handlersFor('account-profile', eventType).at(-1)!;
    await handler('student.verification.approved')({ id: 'e1', eventType: 'student.verification.approved', occurredAt: '2026-10-20T10:00:00.000Z', payload: { verificationId: 'v1', accountId: 'u1', status: 'approved', schoolName: 'A', reason: null, occurredAt: '2026-10-20T10:00:00.000Z', actorId: ACTOR } });
    const beforePayment = notificationManagement.recordInboxNotification.mock.calls.length;
    await handler('booking.confirmed')({ id: 'e2', eventType: 'booking.confirmed', occurredAt: '2026-10-20T10:00:00.000Z', payload: { bookingId: 'b1', studentId: 'u1', teacherId: 'u2', amountCredits: 50 } });
    expect(notificationManagement.recordInboxNotification).toHaveBeenCalledTimes(beforePayment);
    await handler('booking.confirmed')({ id: 'e3', eventType: 'booking.confirmed', occurredAt: '2026-10-20T10:00:00.000Z', payload: { bookingId: 'b1', studentId: 'u1', teacherId: 'u2', amountCredits: 50, settled: true, classId: 'c1' } });
    expect(notificationManagement.recordInboxNotification).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'e3', accountId: 'u2', type: 'booking_confirmed', targetId: 'b1' }));
    await handler('booking.cancelled')({ id: 'e4', eventType: 'booking.cancelled', occurredAt: '2026-10-20T10:00:00.000Z', payload: { bookingId: 'b2', classId: 'c1', learnerId: 'u1', teacherId: 'u2', priceCredits: 10, reason: 'class_cancelled' } });
    await handler('wallet.transaction.completed')({ id: 'e5', eventType: 'wallet.transaction.completed', occurredAt: '2026-10-20T10:00:00.000Z', payload: { transactionId: 'tx1', accountId: 'u1', type: 'top_up', amountCredits: 5, direction: 'credit', occurredAt: '2026-10-20T10:00:00.000Z', actorId: ACTOR } });
    expect(notificationManagement.recordInboxNotification).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'u1', type: 'booking_cancelled', targetId: 'b2' }));
    expect(notificationManagement.recordInboxNotification).toHaveBeenCalledWith(expect.objectContaining({ accountId: 'u1', type: 'wallet_transaction', targetId: 'tx1' }));
  });
});
