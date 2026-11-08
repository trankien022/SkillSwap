import { createZodDto } from 'nestjs-zod';
import {
  deviceSubscriptionSchema,
  markNotificationsReadResponseSchema,
  notificationsPageSchema,
} from '@skillswap/contracts';

/** FR-016 / Route 28: the signed-in caller's notification inbox page. */
export class NotificationsPageDto extends createZodDto(notificationsPageSchema) {}

/** B6: the remaining unread count after marking one or every notification as read. */
export class MarkNotificationsReadDto extends createZodDto(markNotificationsReadResponseSchema) {}

/** Route 29: the account-bound active device subscription. */
export class DeviceSubscriptionDto extends createZodDto(deviceSubscriptionSchema) {}
