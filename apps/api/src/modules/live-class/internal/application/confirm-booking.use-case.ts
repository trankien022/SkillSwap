import type {
  ConfirmBookingCommand,
  ConfirmBookingPort,
  ConfirmBookingResult,
} from './port/in/confirm-booking';
import type { BookingResource } from './port/in/book-class';
import type { BookingRepository } from './port/out/booking-repository';

/**
 * FR-009 / API-006 (ADR-018, ADR-032 Phase C3a): initiates the confirmation request
 * boundary for a pending booking. Emits a durable `booking.confirmed` request event
 * (`settled: false`) via outbox. The booking remains pending (`confirmed: false`)
 * until wallet settlement outcome is authoritatively processed in Phase C3b.
 * There is no synchronous payment claim.
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
