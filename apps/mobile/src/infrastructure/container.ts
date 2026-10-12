import type { BookingGateway } from '@/application/port/booking-gateway';
import { MockBookingGateway } from '@/infrastructure/mock/mock-booking-gateway';
import { httpApiEnabled } from '@/infrastructure/http/api-config';
import { HttpBookingGateway } from '@/infrastructure/http/http-booking-gateway';

import type { VerificationGateway } from '@/application/port/verification-gateway';
import { MockVerificationGateway } from '@/infrastructure/mock/mock-verification-gateway';

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

/**
 * Verification gateway composition helper — returns the mock when no HTTP
 * backend is configured yet. Add an HttpVerificationGateway later if needed.
 */
export function createVerificationGateway(): VerificationGateway {
  return new MockVerificationGateway();
}
