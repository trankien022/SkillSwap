import { ApiResponseError } from '@skillswap/contracts';
import type { BookingGateway } from '@/application/port/booking-gateway';
import {
  BOOKING_REJECTION_REASONS,
  BookingError,
  type BookingRejectionReason,
  type BookingView,
  type ClassView,
} from '@/domain/booking/booking';
import { requestJson, type HttpRequestOptions } from './envelope-http-client';

/**
 * Real HTTP booking gateway (FR-007) — the live implementation of the
 * `BookingGateway` port.
 *
 * It calls the gateway's `/api/classes` endpoints and **unwraps the shared
 * response envelope inside the adapter**, so the port keeps returning bare
 * `ClassView` / `{ booking, created }` payloads. The application service and the
 * UI are therefore byte-for-byte unchanged from the mock version; only the
 * composition root chooses this adapter instead of `MockBookingGateway`.
 *
 * Backend rejections arrive as `{ success: false, code: 'duplicate_booking', ... }`
 * (the domain error class name). This adapter maps that stable `code` onto the
 * domain `BookingRejectionReason`, and everything else onto a plain `Error`.
 */
export class HttpBookingGateway implements BookingGateway {
  constructor(private readonly options: HttpRequestOptions = {}) {}

  async getClass(classId: string): Promise<ClassView> {
    return requestJson<ClassView>(`/classes/${encodeURIComponent(classId)}`, this.options);
  }

  async bookClass(
    classId: string,
    idempotencyKey: string,
  ): Promise<{ booking: BookingView; created: boolean }> {
    try {
      return await requestJson<{ booking: BookingView; created: boolean }>(
        `/classes/${encodeURIComponent(classId)}/book`,
        {
          ...this.options,
          method: 'POST',
          body: { idempotencyKey },
        },
      );
    } catch (error) {
      const reason = toRejectionReason(error);
      if (reason !== null) {
        throw new BookingError(reason, (error as Error).message);
      }
      throw error;
    }
  }
}

/** Maps a transport error's stable `code` onto a booking rejection reason, if it is one. */
export function toRejectionReason(error: unknown): BookingRejectionReason | null {
  if (!(error instanceof ApiResponseError)) {
    return null;
  }
  const codes = [error.code, ...error.errors.map((entry) => entry.code)];
  const match = codes.find((code) =>
    (BOOKING_REJECTION_REASONS as readonly string[]).includes(code),
  );
  return match === undefined ? null : (match as BookingRejectionReason);
}
