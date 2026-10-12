import type { BookingGateway } from '@/application/port/booking-gateway';
import { MockBookingGateway } from '@/infrastructure/mock/mock-booking-gateway';
import { httpApiEnabled } from '@/infrastructure/http/api-config';
import { HttpBookingGateway } from '@/infrastructure/http/http-booking-gateway';

/**
 * Composition root for infrastructure adapters (ADR-015).
 *
 * Picks the live HTTP adapter when a backend base URL is configured, and the
 * in-process mock otherwise. Both satisfy the same ports, so the UI and
 * application layers never change when the app is switched to the real API.
 */
export function createBookingGateway(): BookingGateway {
  return httpApiEnabled() ? new HttpBookingGateway() : new MockBookingGateway();
}
