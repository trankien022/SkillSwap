import { randomUUID } from 'node:crypto';
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
    });
  }
}
