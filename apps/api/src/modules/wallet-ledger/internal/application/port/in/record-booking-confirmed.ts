export const RECORD_BOOKING_CONFIRMED = Symbol('RECORD_BOOKING_CONFIRMED');

export interface BookingConfirmedInput {
  bookingId: string;
  studentId: string;
  teacherId: string;
  amountCredits: number;
}

export interface RecordBookingConfirmedResult {
  /** False when the booking was already settled (idempotent replay). */
  applied: boolean;
  teacherCredits: number;
  platformFeeCredits: number;
}

export interface RecordBookingConfirmedPort {
  execute(event: BookingConfirmedInput): Promise<RecordBookingConfirmedResult>;
}
