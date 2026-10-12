import type { RecordBookingPaymentPort } from './port/in/record-booking-payment';
import type { BookingPaymentRepository } from './port/out/booking-payment-repository';

/** Applies an idempotent wallet outcome through the live-class owned persistence port. */
export class RecordBookingPaymentUseCase implements RecordBookingPaymentPort {
  constructor(private readonly bookings: BookingPaymentRepository) {}

  execute(command: Parameters<RecordBookingPaymentPort['execute']>[0]) {
    return this.bookings.applySuccessfulPayment(command);
  }
}
