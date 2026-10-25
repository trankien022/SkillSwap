import { randomUUID } from 'node:crypto';
import { SYSTEM_ACTOR_ID } from '@skillswap/contracts';
import { splitSettlement } from '../domain/wallet';
import type {
  BookingConfirmedInput,
  RecordBookingConfirmedPort,
  RecordBookingConfirmedResult,
} from './port/in/record-booking-confirmed';
import type { WalletRepository } from './port/out/wallet-repository';

/**
 * FR-009 (ADR-018): settles a confirmed booking — debits the Learner, credits
 * the Teacher's pending income and records the platform fee in one atomic,
 * idempotent operation. Called by the `booking.confirmed` consumer.
 */
export class RecordBookingConfirmedUseCase implements RecordBookingConfirmedPort {
  constructor(private readonly wallets: WalletRepository) {}

  async execute(event: BookingConfirmedInput): Promise<RecordBookingConfirmedResult> {
    if (event.settled) {
      return {
        applied: false,
        teacherCredits: 0,
        platformFeeCredits: 0,
      };
    }
    const { teacherCredits, platformFeeCredits } = splitSettlement(event.amountCredits);
    const outcome = await this.wallets.settleBooking({
      bookingId: event.bookingId,
      learnerId: event.studentId,
      teacherId: event.teacherId,
      priceCredits: event.amountCredits,
      teacherCredits,
      platformFeeCredits,
      traceId: randomUUID(),
      actorId: SYSTEM_ACTOR_ID,
    });
    return {
      applied: outcome.applied,
      teacherCredits: outcome.teacherCredits,
      platformFeeCredits: outcome.platformFeeCredits,
    };
  }
}
