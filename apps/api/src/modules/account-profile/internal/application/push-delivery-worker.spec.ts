import { PushDeliveryWorker, retryDelayMs } from './push-delivery-worker';
import type { PushDelivery, PushDeliveryStorePort, PushReceiptCheck } from './port/push-delivery-store';
import type { PushDeliveryLoggerPort } from './port/push-delivery-logger';
import type { PushProviderPort } from './port/push-provider';

const delivery: PushDelivery = {
  deliveryId: 'delivery-1', notificationId: 'notification-1', deviceId: 'device-1',
  token: 'ExponentPushToken[test]', type: 'booking_cancelled', title: 'Class booking updated',
  body: 'Open your schedule to review the booking.', targetType: 'booking', targetId: 'booking-1', attempts: 1,
};
const receipt: PushReceiptCheck = { deliveryId: 'delivery-1', deviceId: 'device-1', ticketId: 'ticket-1', receiptAttempts: 1 };

function makeLogger(): PushDeliveryLoggerPort {
  return { error: jest.fn() };
}

function makeStore(overrides: Partial<PushDeliveryStorePort> = {}): PushDeliveryStorePort {
  return {
    claimDueDeliveries: jest.fn().mockResolvedValue([]), acceptTicket: jest.fn(), failDelivery: jest.fn(),
    retryDelivery: jest.fn(), claimDueReceipts: jest.fn().mockResolvedValue([]), recordReceipt: jest.fn(),
    retryReceipt: jest.fn(), deactivateDevice: jest.fn(), ...overrides,
  };
}

describe('PushDeliveryWorker', () => {
  it('sends account-owned payload and stores the Expo ticket for receipt polling', async () => {
    const store = makeStore({ claimDueDeliveries: jest.fn().mockResolvedValue([delivery]) });
    const provider = { send: jest.fn().mockResolvedValue({ status: 'ok', ticketId: 'ticket-1' }), getReceipts: jest.fn() };
    const worker = new PushDeliveryWorker(store, provider as unknown as PushProviderPort, makeLogger());

    await worker.sweep();

    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({
      to: delivery.token,
      title: 'Lớp học đã hủy',
      data: { notificationId: 'notification-1', type: 'booking_cancelled', targetType: 'booking', targetId: 'booking-1' },
      channelId: 'skillswap-updates-v1',
    }));
    expect(store.acceptTicket).toHaveBeenCalledWith('delivery-1', 'ticket-1', expect.any(Number));
  });

  it('uses the current device language for remote push', async () => {
    const store = makeStore({ claimDueDeliveries: jest.fn().mockResolvedValue([{ ...delivery, locale: 'en' }]) });
    const provider = { send: jest.fn().mockResolvedValue({ status: 'ok', ticketId: 'ticket-en' }), getReceipts: jest.fn() };
    await new PushDeliveryWorker(store, provider as unknown as PushProviderPort, makeLogger()).sweep();
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({ title: 'Class canceled' }));
  });

  it('deactivates a DeviceNotRegistered subscription and fails the delivery', async () => {
    const store = makeStore({ claimDueDeliveries: jest.fn().mockResolvedValue([delivery]) });
    const provider = {
      send: jest.fn().mockResolvedValue({ status: 'error', message: 'DeviceNotRegistered', deviceNotRegistered: true }),
      getReceipts: jest.fn(),
    };
    await new PushDeliveryWorker(store, provider as unknown as PushProviderPort, makeLogger()).sweep();

    expect(store.deactivateDevice).toHaveBeenCalledWith('device-1');
    expect(store.failDelivery).toHaveBeenCalledWith('delivery-1', 'DeviceNotRegistered');
    expect(store.retryDelivery).not.toHaveBeenCalled();
  });

  it('retries transient send failures with bounded exponential backoff', async () => {
    const store = makeStore({ claimDueDeliveries: jest.fn().mockResolvedValue([delivery]) });
    const provider = { send: jest.fn().mockRejectedValue(new Error('network unavailable')), getReceipts: jest.fn() };
    await new PushDeliveryWorker(store, provider as unknown as PushProviderPort, makeLogger()).sweep();

    expect(store.retryDelivery).toHaveBeenCalledWith('delivery-1', 'network unavailable', 5_000, 5);
    expect(retryDelayMs(7)).toBe(300_000);
  });

  it('records successful provider receipts without treating them as user receipt', async () => {
    const store = makeStore({ claimDueReceipts: jest.fn().mockResolvedValue([receipt]) });
    const provider = { send: jest.fn(), getReceipts: jest.fn().mockResolvedValue({ 'ticket-1': { status: 'ok', ticketId: 'ticket-1' } }) };
    await new PushDeliveryWorker(store, provider as unknown as PushProviderPort, makeLogger()).sweep();

    expect(provider.getReceipts).toHaveBeenCalledWith(['ticket-1']);
    expect(store.recordReceipt).toHaveBeenCalledWith('delivery-1', 'ok');
  });

  it('deactivates a device when a receipt reports DeviceNotRegistered', async () => {
    const store = makeStore({ claimDueReceipts: jest.fn().mockResolvedValue([receipt]) });
    const provider = {
      send: jest.fn(),
      getReceipts: jest.fn().mockResolvedValue({ 'ticket-1': { status: 'error', message: 'Unregistered', deviceNotRegistered: true } }),
    };
    await new PushDeliveryWorker(store, provider as unknown as PushProviderPort, makeLogger()).sweep();

    expect(store.deactivateDevice).toHaveBeenCalledWith('device-1');
    expect(store.recordReceipt).toHaveBeenCalledWith('delivery-1', 'error', 'Unregistered');
  });
});
