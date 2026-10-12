import type { BookingResource } from './book-class';

export const CONFIRM_BOOKING = Symbol('CONFIRM_BOOKING');

export interface ConfirmBookingCommand {
  bookingId: string;
  learnerId: string;
}

export interface ConfirmBookingResult {
  /**
   * Authoritative confirmation indication (ADR-032 Phase C3a/C3b).
   *
   * Under ADR-032 event-driven settlement, a confirmation request is asynchronous:
   * this remains `false` while the request is pending wallet settlement outcome,
   * or when the booking is non-pending (already confirmed, cancelled, expired) or missing.
   * There is no synchronous payment claim.
   */
  confirmed: boolean;
  booking: BookingResource | null;
}

export interface ConfirmBookingPort {
  /**
   * Initiates confirmation of a pending booking. Emits a durable outbox request
   * (`booking.confirmed` with `settled: false`) to wallet-ledger; the booking remains
   * pending (`confirmed: false`) until wallet outcome is consumed (ADR-032 C3a).
   */
  execute(command: ConfirmBookingCommand): Promise<ConfirmBookingResult>;
}
