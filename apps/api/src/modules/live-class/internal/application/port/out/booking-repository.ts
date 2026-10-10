import type { BookingState, CancelReason } from '../../../domain/booking';

export const BOOKING_REPOSITORY = Symbol('BOOKING_REPOSITORY');

export interface PersistedBooking {
  id: string;
  classId: string;
  learnerId: string;
  state: BookingState;
  priceCredits: number;
  idempotencyKey: string;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface CreateBookingRecord {
  classId: string;
  learnerId: string;
  state: BookingState;
  priceCredits: number;
  idempotencyKey: string;
  expiresAt: Date;
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
  findById(bookingId: string): Promise<PersistedBooking | null>;
  /**
   * FR-009 (ADR-018): atomically flips a `pending` booking to `confirmed` and
   * writes a `booking.confirmed` row to the outbox in the SAME transaction, so
   * the wallet-ledger settlement can never diverge from the booking state.
   * Returns `{ confirmed: false }` when the booking is not `pending` (replay).
   */
  confirmAndEmit(
    bookingId: string,
    learnerId: string,
  ): Promise<{ confirmed: boolean; booking: PersistedBooking | null }>;
  /**
   * FR-007 / ADR-019: cancels a `pending` or `confirmed` booking, records the
   * reason, and (for a confirmed booking) writes a `booking.cancelled` outbox
   * row in the SAME transaction so the wallet refunds exactly once.
   */
  cancelAndEmit(
    bookingId: string,
    reason: CancelReason,
  ): Promise<{ cancelled: boolean; booking: PersistedBooking | null }>;
  /**
   * FR-007 / AC-026: cancels every `pending` booking whose hold has expired at
   * or before `now` (atomic, idempotent) and emits one `booking.cancelled`
   * (reason `expired`) per cancelled booking. Returns the cancelled count.
   */
  expirePendingHolds(now: Date): Promise<number>;
  /** Count bookings in a given state for a class (edit-lock, class cancel). */
  countByClassAndState(classId: string, state: BookingState): Promise<number>;
  /** Active (pending|confirmed) bookings for a class, for class cancellation. */
  findActiveByClass(classId: string): Promise<PersistedBooking[]>;
}
