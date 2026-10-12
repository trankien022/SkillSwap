import {
  bookClassResponseSchema,
  confirmBookingResponseSchema,
  type BookClassResponse,
  type ConfirmBookingResponse,
  classDetailViewSchema,
  type BookingView,
  type ClassDetailView,
} from '@skillswap/contracts';
import type { GatewayClient } from './gateway-client';

/**
 * HTTP Gateway adapter for class detail view and booking actions (FR-007, FR-009).
 *
 * Implements:
 * - Route 14: GET /api/classes/:id (class detail, public teacher summary, own booking status)
 * - Route 05 / API-005: POST /api/classes/:id/bookings with idempotencyKey in body & header
 * - Route 06 / API-006: POST /api/classes/bookings/:bookingId/confirm (no body)
 *
 * Relies on GatewayClient.authenticatedRequest as the sole HTTP retry owner:
 * - Eligible GET requests retry at most once on 401 after token refresh.
 * - POST commands NEVER auto-replay on 401; caller reconciles using idempotency.
 */
export class BookingHttpGateway {
  constructor(private readonly gateway: GatewayClient) {}

  async getClassDetail(classId: string): Promise<ClassDetailView> {
    const raw = await this.gateway.authenticatedRequest<unknown>(
      `/classes/${encodeURIComponent(classId)}`,
      { method: 'GET' },
    );
    return classDetailViewSchema.parse(raw);
  }

  async bookClass(
    classId: string,
    idempotencyKey: string,
  ): Promise<BookClassResponse> {
    const raw = await this.gateway.authenticatedRequest<unknown>(
      `/classes/${encodeURIComponent(classId)}/bookings`,
      {
        method: 'POST',
        body: { idempotencyKey },
        idempotencyKey,
      },
    );
    return bookClassResponseSchema.parse(raw);
  }

  async confirmBooking(bookingId: string): Promise<ConfirmBookingResponse> {
    const raw = await this.gateway.authenticatedRequest<unknown>(
      `/classes/bookings/${encodeURIComponent(bookingId)}/confirm`,
      {
        method: 'POST',
      },
    );
    return confirmBookingResponseSchema.parse(raw);
  }

  async confirm(bookingId: string): Promise<ConfirmBookingResponse> {
    return this.confirmBooking(bookingId);
  }
}
export {
  bookClassResponseSchema,
  confirmBookingResponseSchema,
  type BookClassResponse,
  type ConfirmBookingResponse,
  type BookingView,
  type ClassDetailView,
};
