import { createZodDto } from 'nestjs-zod';
import {
  deviceSubscriptionSchema,
  notificationsPageSchema,
} from '@skillswap/contracts';

/** FR-016 / Route 28: the signed-in caller's notification inbox page. */
export class NotificationsPageDto extends createZodDto(notificationsPageSchema) {}

/** Route 29: the account-bound active device subscription. */
export class DeviceSubscriptionDto extends createZodDto(deviceSubscriptionSchema) {}
