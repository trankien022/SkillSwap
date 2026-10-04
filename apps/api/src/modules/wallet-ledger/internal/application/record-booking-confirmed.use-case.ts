import { applyPlatformFee } from '../domain/wallet';
import type {
  BookingConfirmedInput,
  RecordBookingConfirmedPort,
  RecordBookingConfirmedResult,
} from './port/in/record-booking-confirmed';
import type { LedgerEntryWriter } from './port/out/ledger-entry-writer';

/** Applies the platform fee split and credits the teacher's ledger (idempotent). */
export class RecordBookingConfirmedUseCase implements RecordBookingConfirmedPort {
  constructor(private readonly ledger: LedgerEntryWriter) {}

  async execute(event: BookingConfirmedInput): Promise<RecordBookingConfirmedResult> {
    const { platformFeeCredits, teacherCredits } = applyPlatformFee(event.amountCredits);
    const outcome = await this.ledger.creditTeacher({
      bookingId: event.bookingId,
      teacherId: event.teacherId,
      amountCredits: teacherCredits,
    });
    return { recorded: outcome.recorded, teacherCredits, platformFeeCredits };
  }
}
