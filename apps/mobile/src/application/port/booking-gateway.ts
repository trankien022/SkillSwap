import type { BookingView, ClassView } from '@/domain/booking/booking';

export const BOOKING_GATEWAY = Symbol('BOOKING_GATEWAY');

/**
 * Port the UI depends on. The mock adapter implements it now; a real HTTP
 * adapter (same shape, calling the gateway) can replace it without touching UI.
 */
export interface BookingGateway {
  getClass(classId: string): Promise<ClassView>;
  bookClass(classId: string, idempotencyKey: string): Promise<{ booking: BookingView; created: boolean }>;
}
