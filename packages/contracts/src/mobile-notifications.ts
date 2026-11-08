import { z } from 'zod';
import { MAX_PAGE_LIMIT } from './pagination';

export const notificationTypeSchema = z.enum(['verification_outcome','booking_confirmed','booking_cancelled','class_starting_soon','wallet_transaction','withdrawal_outcome']);
export const notificationTargetTypeSchema = z.enum(['class','booking','wallet','verification']);
export const notificationItemSchema = z.object({
  id: z.string().min(1), type: notificationTypeSchema, title: z.string().min(1), body: z.string().min(1),
  targetType: notificationTargetTypeSchema, targetId: z.string().min(1), read: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
});
export const notificationsPageSchema = z.object({ items: z.array(notificationItemSchema), nextCursor: z.string().nullable(), unreadCount: z.number().int().nonnegative() });
/**
 * `unreadOnly` is an explicit `'true'`/`'false'` string, not `z.coerce.boolean()`: Node hands
 * every query parameter over as a string, and `Boolean('false')` is `true`, so coercion made
 * `?unreadOnly=false` return only unread rows — the opposite of the request. `myBookingsQuerySchema`
 * uses this same transform for `upcoming`; the two boolean query params now agree. An omitted
 * parameter stays `undefined` ("no filter") rather than defaulting to `false`.
 */
export const listNotificationsQuerySchema = z.object({ unreadOnly: z.enum(['true', 'false']).transform((v) => v === 'true').optional(), limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(20), cursor: z.string().min(1).optional() });
export const upsertDeviceSchema = z.object({ token: z.string().min(1), platform: z.enum(['ios','android','web']), installationId: z.string().min(1).max(128), locale: z.enum(['vi', 'en']).optional(), appVersion: z.string().max(32).optional() });
export const deviceSubscriptionSchema = z.object({ id: z.string().min(1), installationId: z.string().min(1), platform: z.enum(['ios','android','web']), isActive: z.boolean(), createdAt: z.string().datetime({ offset: true }) });
export type NotificationItem = z.infer<typeof notificationItemSchema>;
export type NotificationsPage = z.infer<typeof notificationsPageSchema>;
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type UpsertDeviceInput = z.infer<typeof upsertDeviceSchema>;
export type DeviceSubscription = z.infer<typeof deviceSubscriptionSchema>;

/**
 * B6: `POST /notifications/:id/read` and `POST /notifications/read-all` both answer with the
 * inbox's remaining unread count, so a client can clear its badge without a second round trip.
 */
export const markNotificationsReadResponseSchema = z.object({
  success: z.literal(true),
  unreadCount: z.number().int().nonnegative(),
});
export type MarkNotificationsReadResponse = z.infer<typeof markNotificationsReadResponseSchema>;
