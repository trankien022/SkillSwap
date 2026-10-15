import {
  bookClassResponseSchema,
  classDetailViewSchema,
  confirmBookingResponseSchema,
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
  type ConfirmBookingResponse,
  type OwnBookingSummaryView,
} from './domain';

/**
 * Real HTTP booking gateway (FR-007) — the live implementation of the
 * `BookingGateway` port, mirroring `apps/mobile/.../booking-http-gateway.ts`.
 *
 * It talks to the gateway's `/api/classes` endpoints and **maps the backend's
 * stable rejection `code` onto the domain `BookingError`** that the UI already
 * translates, so the booking UI stays presentation-only: only the composition
 * root picks this adapter instead of `MockBookingGateway`.
 *
 * Endpoints:
 * - GET  /classes/:id                 — class detail (state, capacity, own booking)
 * - POST /classes/:id/bookings        — create a booking (idempotencyKey)
 * - POST /classes/bookings/:id/confirm — settle a hold into a paid booking
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

  /**
   * `POST /classes/bookings/:id/confirm` — the settlement request. The answer
   * is parsed and returned as-is: `confirmed: false` is a legitimate reply while
   * the debit is still settling, so it is data, not an error (NFR-005).
   */
  async confirmBooking(bookingId: string): Promise<ConfirmBookingResponse> {
    const res = await callApi(`/classes/bookings/${encodeURIComponent(bookingId)}/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    return confirmBookingResponseSchema.parse(await unwrapEnvelope<unknown>(res));
  }

  /**
   * The caller's own hold, read back from `GET /classes/:id` — the same read
   * `getClass` uses, keeping the verdict (`ownBooking`) that tells the UI a
   * seat is already held instead of issuing a second booking.
   */
  async getOwnBooking(classId: string): Promise<OwnBookingSummaryView | null> {
    const res = await callApi(`/classes/${encodeURIComponent(classId)}`);
    const detail = classDetailViewSchema.parse(await unwrapEnvelope<unknown>(res));
    return detail.ownBooking ?? null;
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
