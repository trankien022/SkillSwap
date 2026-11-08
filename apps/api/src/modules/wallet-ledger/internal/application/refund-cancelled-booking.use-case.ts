import { randomUUID } from 'node:crypto';
import { SYSTEM_ACTOR_ID } from '@skillswap/contracts';
import type {
  BookingCancelledInput,
  RefundCancelledBookingPort,
} from './port/in/refund-cancelled-booking';
import type { WalletRepository } from './port/out/wallet-repository';

/**
 * FR-007 (ADR-019): refunds a cancelled booking. A no-op when the booking was
 * never settled or already refunded, so replayed events are harmless.
 */
export class RefundCancelledBookingUseCase implements RefundCancelledBookingPort {
  constructor(private readonly wallets: WalletRepository) {}

  async execute(event: BookingCancelledInput): Promise<{ applied: boolean }> {
    return this.wallets.refundBooking({
      bookingId: event.bookingId,
      learnerId: event.learnerId,
      teacherId: event.teacherId,
      priceCredits: event.priceCredits,
      traceId: randomUUID(),
      // B11 / ADR-035: a cancellation refund is driven by the event consumer, not by a person, so
      // the actor is the system. `learnerId` above is the beneficiary and stays distinct from it.
      actorId: SYSTEM_ACTOR_ID,
    });
  }
}
