import type { BookingResource } from './book-class';

export const CONFIRM_BOOKING = Symbol('CONFIRM_BOOKING');

export interface ConfirmBookingCommand {
  bookingId: string;
  learnerId: string;
}

export interface ConfirmBookingResult {
  /** False when the booking was not `pending` (already confirmed or gone). */
  confirmed: boolean;
  booking: BookingResource | null;
}

export interface ConfirmBookingPort {
  execute(command: ConfirmBookingCommand): Promise<ConfirmBookingResult>;
}
