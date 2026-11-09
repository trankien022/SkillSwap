import type { DataSource } from 'typeorm';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import type { PushDelivery, PushDeliveryStorePort } from '../../../application/port/push-delivery-store';
import type { PushDeliveryLoggerPort } from '../../../application/port/push-delivery-logger';
import type { PushProviderPort } from '../../../application/port/push-provider';
import { PushDeliveryWorker } from '../../../application/push-delivery-worker';
import { SqlNotificationManagement } from './sql-notification-management';

/**
 * B7's last box: the push text and the inbox text are the same string for the same event.
 *
 * Both sides are wired to their real implementations — the worker through its store port, the inbox
 * through the SQL adapter — so this fails if either drifts to its own copy table. The two used to
 * disagree by construction: the adapter held an English-only switch, so a Vietnamese push landed
 * next to an English inbox row for one and the same `class.cancelled` event.
 */
describe('push and inbox agree on the copy (B7)', () => {
  const stored = {
    id: 'n1', type: 'booking_cancelled',
    // Deliberately wrong, to prove the reader never renders the write-time text.
    title: 'STORED', body: 'STORED',
    target_type: 'booking', target_id: 'b1', read: false,
    created_at: new Date('2026-11-07T10:00:00.000Z'),
  };

  function inbox(locale?: 'vi' | 'en') {
    const query = jest.fn()
      .mockResolvedValueOnce([stored])
      .mockResolvedValueOnce([{ count: '1' }])
      // The device lookup always runs when the caller states no language; an empty
      // result is "this account registered no active device".
      .mockResolvedValueOnce(locale === undefined ? [] : [{ locale }]);
    const registry = {
      get: jest.fn().mockReturnValue({ query } as unknown as DataSource),
      getSchema: jest.fn().mockReturnValue('account_profile'),
    } as unknown as ModuleDataSourceRegistry;
    return new SqlNotificationManagement(registry, 'account-profile');
  }

  async function pushed(notification: Pick<PushDelivery, 'locale'>) {
    const delivery: PushDelivery = {
      deliveryId: 'delivery-1', notificationId: 'n1', deviceId: 'device-1',
      token: 'ExponentPushToken[test]', type: 'booking_cancelled',
      title: 'STORED', body: 'STORED',
      targetType: 'booking', targetId: 'b1', attempts: 1, ...notification,
    };
    const store: PushDeliveryStorePort = {
      claimDueDeliveries: jest.fn().mockResolvedValue([delivery]), acceptTicket: jest.fn(),
      failDelivery: jest.fn(), retryDelivery: jest.fn(),
      claimDueReceipts: jest.fn().mockResolvedValue([]), recordReceipt: jest.fn(),
      retryReceipt: jest.fn(), deactivateDevice: jest.fn(),
    };
    const provider = { send: jest.fn().mockResolvedValue({ status: 'ok', ticketId: 'ticket-1' }), getReceipts: jest.fn() };
    await new PushDeliveryWorker(store, provider as unknown as PushProviderPort, { error: jest.fn() } as PushDeliveryLoggerPort).sweep();
    return (provider.send.mock.calls[0]?.[0] ?? {}) as { title: string; body: string };
  }

  it('sends and lists the same Vietnamese strings', async () => {
    const page = await inbox('vi').list('account-1', { limit: 20 });
    const push = await pushed({ locale: 'vi' });

    expect(page.items[0]?.title).toBe('Lớp học đã hủy');
    expect(push.title).toBe('Lớp học đã hủy');
    expect(page.items[0]?.body).toBe(push.body);
  });

  it('sends and lists the same English strings', async () => {
    const page = await inbox('en').list('account-1', { limit: 20 });
    const push = await pushed({ locale: 'en' });

    expect(page.items[0]?.title).toBe('Class canceled');
    expect(push.title).toBe('Class canceled');
    expect(page.items[0]?.body).toBe(push.body);
  });

  it('agrees on the English default when neither side knows a language', async () => {
    // The inbox has no active device and the delivery has no locale yet. Defect #3:
    // this default used to be `vi`, which rendered `/en/notifications` in Vietnamese
    // for every web-only account. Both sides now read the one constant.
    const page = await inbox().list('account-1', { limit: 20 });
    const push = await pushed({});

    expect(page.items[0]?.title).toBe(push.title);
    expect(page.items[0]?.body).toBe(push.body);
    expect(push.title).toBe('Class canceled');
  });

  it('lets the reader’s stated language beat a conflicting device language', async () => {
    // The account's device says Vietnamese (a native app), but this read is a browser on
    // /en. The screen states its language, so the row must follow the screen.
    const page = await inbox('vi').list('account-1', { limit: 20 }, undefined, 'en');
    const push = await pushed({ locale: 'vi' });

    expect(page.items[0]?.title).toBe('Class canceled');
    // The push still goes to the device in the device's language; only this read moved.
    expect(push.title).toBe('Lớp học đã hủy');
  });
});
