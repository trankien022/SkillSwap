export const PUSH_DELIVERY_LOGGER = Symbol('PUSH_DELIVERY_LOGGER');

export interface PushDeliveryLoggerPort {
  error(error: unknown, message: string): void;
}
