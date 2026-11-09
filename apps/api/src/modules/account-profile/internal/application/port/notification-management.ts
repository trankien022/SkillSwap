import type { DeviceSubscription, ListNotificationsQuery, NotificationsPage, UpsertDeviceInput } from '@skillswap/contracts';

export const NOTIFICATION_MANAGEMENT = Symbol('NOTIFICATION_MANAGEMENT');
export interface RecordInboxNotification {
  eventId: string; accountId: string; type: 'verification_outcome'|'booking_confirmed'|'booking_cancelled'|'class_starting_soon'|'wallet_transaction'|'withdrawal_outcome';
  targetType: 'class'|'booking'|'wallet'|'verification'; targetId: string;
}
export interface NotificationManagementPort {
  /**
   * `requestLocale` is the language the *caller* asked to be answered in (its
   * `Accept-Language`), when they expressed one. It outranks the stored device
   * language: the device language describes an installation, and an inbox read in a
   * browser is a person reading a screen in the language of that screen.
   */
  list(
    accountId: string,
    query: ListNotificationsQuery,
    cursor?: readonly [Date, string],
    requestLocale?: 'vi' | 'en',
  ): Promise<NotificationsPage>;
  upsertDevice(accountId: string, input: UpsertDeviceInput): Promise<DeviceSubscription>;
  deleteDevice(accountId: string, id: string): Promise<{ success: true }>;
  recordInboxNotification(notification: RecordInboxNotification): Promise<void>;
  /**
   * B6: flips one row owned by `accountId` to read and returns the inbox's remaining unread
   * count. Returns `null` when no such row is owned by the caller, so the controller can answer
   * 404 without confirming that the id exists at all.
   */
  markRead(accountId: string, id: string): Promise<number | null>;
  /** B6: flips every unread row owned by `accountId`; returns the remaining unread count. */
  markAllRead(accountId: string): Promise<number>;
}
