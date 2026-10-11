import type {
  BookingPaymentDisposition,
  RecordBookingPaymentCommand,
  RecordBookingPaymentResult,
} from '../in/record-booking-payment';

export const BOOKING_PAYMENT_REPOSITORY = Symbol('BOOKING_PAYMENT_REPOSITORY');

export interface BookingPaymentRepository {
  applySuccessfulPayment(
    payment: RecordBookingPaymentCommand,
  ): Promise<RecordBookingPaymentResult>;
}

export type { BookingPaymentDisposition };
