import type { PushDeliveryStorePort } from './port/push-delivery-store';
import type { PushDeliveryLoggerPort } from './port/push-delivery-logger';
import type { PushProviderPort, PushProviderResult } from './port/push-provider';

export const PUSH_SWEEP_INTERVAL_MS = 5_000;
export const PUSH_BATCH_SIZE = 50;
export const PUSH_MAX_ATTEMPTS = 5;
export const PUSH_LEASE_SECONDS = 60;
export const EXPO_RECEIPT_DELAY_MS = 15_000;

export function retryDelayMs(attempt: number): number {
  return Math.min(5 * 60_000, 5_000 * 2 ** Math.max(0, attempt - 1));
}

/** Durable Expo push relay; database leases recover work after a process restart. */
export class PushDeliveryWorker {
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly store: PushDeliveryStorePort,
    private readonly provider: PushProviderPort,
    private readonly logger: PushDeliveryLoggerPort,
    private readonly intervalMs: number = PUSH_SWEEP_INTERVAL_MS,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.sweep(), this.intervalMs);
    this.timer.unref?.();
    void this.sweep();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async sweep(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await Promise.all([this.dispatchDue(), this.pollReceipts()]);
    } catch (error) {
      this.logger.error(error, 'Push delivery sweep failed');
    } finally {
      this.running = false;
    }
  }

  private async dispatchDue(): Promise<void> {
    const deliveries = await this.store.claimDueDeliveries(PUSH_BATCH_SIZE, PUSH_LEASE_SECONDS);
    await Promise.all(deliveries.map(async (delivery) => {
      const data = {
        notificationId: delivery.notificationId,
        type: delivery.type,
        targetType: delivery.targetType,
        targetId: delivery.targetId,
      };
      try {
        const result = await this.provider.send({
          to: delivery.token,
          title: delivery.title,
          body: delivery.body,
          data,
          channelId: 'skillswap-updates-v1',
          sound: 'default',
        });
        if (result.status === 'ok' && result.ticketId) {
          await this.store.acceptTicket(delivery.deliveryId, result.ticketId, EXPO_RECEIPT_DELAY_MS);
        } else if (result.status === 'error' && result.deviceNotRegistered) {
          await this.store.deactivateDevice(delivery.deviceId);
          await this.store.failDelivery(delivery.deliveryId, result.message);
        } else {
          const message = result.status === 'error' ? result.message : 'Expo push ticket had no receipt ID';
          await this.store.retryDelivery(delivery.deliveryId, message, retryDelayMs(delivery.attempts), PUSH_MAX_ATTEMPTS);
        }
      } catch (error) {
        await this.store.retryDelivery(delivery.deliveryId, error instanceof Error ? error.message : String(error), retryDelayMs(delivery.attempts), PUSH_MAX_ATTEMPTS);
      }
    }));
  }

  private async pollReceipts(): Promise<void> {
    const receipts = await this.store.claimDueReceipts(PUSH_BATCH_SIZE, PUSH_LEASE_SECONDS);
    if (receipts.length === 0) return;
    let results: Readonly<Record<string, PushProviderResult>>;
    try {
      results = await this.provider.getReceipts(receipts.map((receipt) => receipt.ticketId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await Promise.all(receipts.map((receipt) => this.store.retryReceipt(receipt.deliveryId, message, retryDelayMs(receipt.receiptAttempts), PUSH_MAX_ATTEMPTS)));
      return;
    }
    await Promise.all(receipts.map(async (receipt) => {
      const result = results[receipt.ticketId];
      if (!result) {
        await this.store.retryReceipt(receipt.deliveryId, 'Expo receipt is not available yet', retryDelayMs(receipt.receiptAttempts), PUSH_MAX_ATTEMPTS);
      } else if (result.status === 'ok') {
        await this.store.recordReceipt(receipt.deliveryId, 'ok');
      } else if (result.status === 'error' && result.deviceNotRegistered) {
        await this.store.deactivateDevice(receipt.deviceId);
        await this.store.recordReceipt(receipt.deliveryId, 'error', result.message);
      } else if (result.status === 'error') {
        await this.store.retryReceipt(receipt.deliveryId, result.message, retryDelayMs(receipt.receiptAttempts), PUSH_MAX_ATTEMPTS);
      } else {
        await this.store.recordReceipt(receipt.deliveryId, 'ok');
      }
    }));
  }
}
