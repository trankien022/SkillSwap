import type { DeviceSubscription, ListNotificationsQuery, NotificationsPage, UpsertDeviceInput } from '@skillswap/contracts';

export const NOTIFICATION_MANAGEMENT = Symbol('NOTIFICATION_MANAGEMENT');
export interface RecordInboxNotification {
  eventId: string; accountId: string; type: 'verification_outcome'|'booking_confirmed'|'booking_cancelled'|'class_starting_soon'|'wallet_transaction'|'withdrawal_outcome';
  targetType: 'class'|'booking'|'wallet'|'verification'; targetId: string;
}
export interface NotificationManagementPort {
  list(accountId: string, query: ListNotificationsQuery, cursor?: readonly [Date, string]): Promise<NotificationsPage>;
  upsertDevice(accountId: string, input: UpsertDeviceInput): Promise<DeviceSubscription>;
  deleteDevice(accountId: string, id: string): Promise<{ success: true }>;
  recordInboxNotification(notification: RecordInboxNotification): Promise<void>;
}
