export const PUSH_DELIVERY_STORE = Symbol('PUSH_DELIVERY_STORE');

export interface PushDelivery {
  readonly deliveryId: string;
  readonly notificationId: string;
  readonly deviceId: string;
  readonly token: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly attempts: number;
}

export interface PushReceiptCheck {
  readonly deliveryId: string;
  readonly deviceId: string;
  readonly ticketId: string;
  readonly receiptAttempts: number;
}

export interface PushDeliveryStorePort {
  claimDueDeliveries(limit: number, leaseSeconds: number): Promise<PushDelivery[]>;
  acceptTicket(deliveryId: string, ticketId: string, receiptDelayMs: number): Promise<void>;
  failDelivery(deliveryId: string, message: string): Promise<void>;
  retryDelivery(deliveryId: string, message: string, delayMs: number, maxAttempts: number): Promise<void>;
  claimDueReceipts(limit: number, leaseSeconds: number): Promise<PushReceiptCheck[]>;
  recordReceipt(deliveryId: string, status: 'ok' | 'error', message?: string): Promise<void>;
  retryReceipt(deliveryId: string, message: string, delayMs: number, maxAttempts: number): Promise<void>;
  deactivateDevice(deviceId: string): Promise<void>;
}
