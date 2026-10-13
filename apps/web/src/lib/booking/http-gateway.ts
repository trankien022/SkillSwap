import {
  bookClassResponseSchema,
  classDetailViewSchema,
  ApiResponseError,
  type ClassView,
} from '@skillswap/contracts';
import { callApi, unwrapEnvelope } from '../api-client';
import {
  BOOKING_REJECTION_REASONS,
  BookingError,
  type BookClassResult,
  type BookingGateway,
  type BookingRejectionReason,
} from './domain';

/**
 * Real HTTP booking gateway (FR-007) — the live implementation of the
 * `BookingGateway` port, mirroring `apps/mobile/.../booking-http-gateway.ts`.
 *
 * It talks to the gateway's `/api/classes` endpoints and **maps the backend's
 * stable rejection `code` onto the domain `BookingError`** that the UI already
 * translates, so `booking-panel.tsx` needs no change: only the composition root
 * picks this adapter instead of `MockBookingGateway`.
 *
 * Endpoints:
 * - GET  /classes/:id            — class detail (state, capacity, own booking)
 * - POST /classes/:id/bookings   — create a booking (idempotencyKey)
 *
 * The booking command is never auto-replayed: `callApi` retries only on 401,
 * and even then the idempotency key makes a replay safe.
 */
export class HttpBookingGateway implements BookingGateway {
  /**
   * `GET /classes/:id` answers with the richer `classDetailViewSchema`, so the
   * fields the panel needs are mapped onto `ClassView` explicitly. No cast: if
   * the API ever stops returning one of these, the parse fails loudly instead
   * of the UI silently rendering `undefined`.
   */
  async getClass(classId: string): Promise<ClassView> {
    const res = await callApi(`/classes/${encodeURIComponent(classId)}`);
    const detail = classDetailViewSchema.parse(await unwrapEnvelope<unknown>(res));
    return {
      id: detail.id,
      teacherId: detail.teacher.id,
      state: detail.state,
      startsAt: detail.startsAt,
      durationMinutes: detail.durationMinutes,
      priceCredits: detail.priceCredits,
      capacity: detail.capacity,
    };
  }

  async bookClass(classId: string, idempotencyKey: string): Promise<BookClassResult> {
    const res = await callApi(`/classes/${encodeURIComponent(classId)}/bookings`, {
      method: 'POST',
      body: JSON.stringify({ idempotencyKey }),
      headers: { 'idempotency-key': idempotencyKey },
    });

    try {
      const raw = await unwrapEnvelope<unknown>(res);
      const parsed = bookClassResponseSchema.parse(raw);
      return { booking: parsed.booking, created: parsed.created };
    } catch (error) {
      throw toBookingError(error);
    }
  }
}

/**
 * Maps a backend rejection onto the domain error. The API returns the domain
 * error class name as a stable `code` (e.g. `class_full`), so an unknown code
 * degrades to `class_not_bookable` rather than crashing the panel.
 */
function toBookingError(error: unknown): BookingError {
  const code =
    error instanceof ApiResponseError ? error.code : (error as { code?: string } | null)?.code;

  const reason: BookingRejectionReason = BOOKING_REJECTION_REASONS.includes(
    code as BookingRejectionReason,
  )
    ? (code as BookingRejectionReason)
    : 'class_not_bookable';

  const message = error instanceof Error ? error.message : 'Booking failed';
  return new BookingError(reason, message);
}
