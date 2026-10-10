export const REFUND_CANCELLED_BOOKING = Symbol('REFUND_CANCELLED_BOOKING');

export interface BookingCancelledInput {
  bookingId: string;
  classId: string;
  learnerId: string;
  teacherId: string;
  priceCredits: number;
}

export interface RefundCancelledBookingPort {
  execute(event: BookingCancelledInput): Promise<{ applied: boolean }>;
}
