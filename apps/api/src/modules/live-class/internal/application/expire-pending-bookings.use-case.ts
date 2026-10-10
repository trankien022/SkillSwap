import type { BookingRepository } from './port/out/booking-repository';
import type { Clock } from './port/out/clock';
import type { ExpirePendingBookingsPort } from './port/in/expire-pending-bookings';

/**
 * FR-007 / AC-026 (ADR-019): releases seats held by expired pending bookings.
 * Idempotent and safe to run concurrently — the underlying UPDATE is atomic.
 */
export class ExpirePendingBookingsUseCase implements ExpirePendingBookingsPort {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<{ expired: number }> {
    const expired = await this.bookings.expirePendingHolds(this.clock.now());
    return { expired };
  }
}
