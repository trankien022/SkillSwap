import { z } from 'zod';

export const notificationTypeSchema = z.enum(['verification_outcome','booking_confirmed','booking_cancelled','class_starting_soon','wallet_transaction','withdrawal_outcome']);
export const notificationTargetTypeSchema = z.enum(['class','booking','wallet','verification']);
export const notificationItemSchema = z.object({
  id: z.string().min(1), type: notificationTypeSchema, title: z.string().min(1), body: z.string().min(1),
  targetType: notificationTargetTypeSchema, targetId: z.string().min(1), read: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
});
export const notificationsPageSchema = z.object({ items: z.array(notificationItemSchema), nextCursor: z.string().nullable(), unreadCount: z.number().int().nonnegative() });
export const listNotificationsQuerySchema = z.object({ unreadOnly: z.coerce.boolean().optional(), limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().min(1).optional() });
export const upsertDeviceSchema = z.object({ token: z.string().min(1), platform: z.enum(['ios','android','web']), installationId: z.string().min(1).max(128), appVersion: z.string().max(32).optional() });
export const deviceSubscriptionSchema = z.object({ id: z.string().min(1), installationId: z.string().min(1), platform: z.enum(['ios','android','web']), isActive: z.boolean(), createdAt: z.string().datetime({ offset: true }) });
export const deleteDeviceResultSchema = z.object({ success: z.literal(true) });
export type NotificationItem = z.infer<typeof notificationItemSchema>;
export type NotificationsPage = z.infer<typeof notificationsPageSchema>;
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type UpsertDeviceInput = z.infer<typeof upsertDeviceSchema>;
export type DeviceSubscription = z.infer<typeof deviceSubscriptionSchema>;
