import type {
  ConfirmBookingCommand,
  ConfirmBookingPort,
  ConfirmBookingResult,
} from './port/in/confirm-booking';
import type { BookingResource } from './port/in/book-class';
import type { BookingRepository } from './port/out/booking-repository';

/**
 * FR-009 / API-006 (ADR-018): confirms a pending booking. The state change and
 * the `booking.confirmed` outbox event are written in one transaction, so the
 * wallet-ledger settles exactly the bookings that were confirmed.
 */
export class ConfirmBookingUseCase implements ConfirmBookingPort {
  constructor(private readonly bookings: BookingRepository) {}

  async execute(command: ConfirmBookingCommand): Promise<ConfirmBookingResult> {
    const outcome = await this.bookings.confirmAndEmit(command.bookingId, command.learnerId);
    return {
      confirmed: outcome.confirmed,
      booking: outcome.booking === null ? null : toResource(outcome.booking),
    };
  }
}

function toResource(booking: {
  id: string;
  classId: string;
  learnerId: string;
  state: string;
  priceCredits: number;
  createdAt: Date;
}): BookingResource {
  return {
    bookingId: booking.id,
    classId: booking.classId,
    learnerId: booking.learnerId,
    state: booking.state,
    priceCredits: booking.priceCredits,
    createdAt: booking.createdAt.toISOString(),
  };
}
