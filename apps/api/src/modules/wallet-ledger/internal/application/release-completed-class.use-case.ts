import { randomUUID } from 'node:crypto';
import { splitSettlement } from '../domain/wallet';
import type { WalletRepository } from './port/out/wallet-repository';
import type {
  ClassCompletedInput,
  ReleaseCompletedClassPort,
  ReleaseCompletedClassResult,
} from './port/in/release-completed-class';

/**
 * FR-020 / ADR-021: on class completion, releases the Teacher's pending income
 * for each confirmed booking. Idempotent per (booking, release key) via the
 * wallet repository, so a replayed `class.completed` releases nothing extra.
 */
export class ReleaseCompletedClassUseCase implements ReleaseCompletedClassPort {
  constructor(private readonly wallets: WalletRepository) {}

  async execute(event: ClassCompletedInput): Promise<ReleaseCompletedClassResult> {
    let released = 0;
    for (const booking of event.bookings) {
      const { teacherCredits } = splitSettlement(booking.priceCredits);
      const outcome = await this.wallets.releaseIncome({
        bookingId: booking.bookingId,
        teacherId: event.teacherId,
        amountCredits: teacherCredits,
        releaseKey: `class-completed:${event.classId}`,
        traceId: randomUUID(),
      });
      if (outcome.applied) {
        released += 1;
      }
    }
    return { released };
  }
}
