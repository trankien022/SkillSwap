import type { BookingState } from '../../../domain/booking';

export const BOOKING_REPOSITORY = Symbol('BOOKING_REPOSITORY');

export interface PersistedBooking {
  id: string;
  classId: string;
  learnerId: string;
  state: BookingState;
  priceCredits: number;
  idempotencyKey: string;
  createdAt: Date;
}

export interface CreateBookingRecord {
  classId: string;
  learnerId: string;
  state: BookingState;
  priceCredits: number;
  idempotencyKey: string;
}

/** A booking row as needed for capacity and duplicate checks. */
export interface BookingSeatRow {
  learnerId: string;
  state: BookingState;
}

export class BookingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingConflictError';
  }
}

export interface BookingRepository {
  /**
   * Atomically, inside one transaction: locks the class row (serializing the
   * last-seat race, AC-010), reads the seat rows, then lets `guard` decide and
   * inserts the booking. `guard` may throw a domain error to abort. A replay of
   * an existing idempotency key returns the stored booking without inserting.
   */
  createWithSeatGuard(
    record: CreateBookingRecord,
    guard: (seatRows: readonly BookingSeatRow[]) => void,
  ): Promise<{ booking: PersistedBooking; created: boolean }>;
  findByIdempotencyKey(idempotencyKey: string): Promise<PersistedBooking | null>;
}
