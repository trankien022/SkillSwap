export const RECORD_BOOKING_PAYMENT = Symbol('RECORD_BOOKING_PAYMENT');

/** A successful, persisted learner debit from the canonical wallet event family. */
export interface RecordBookingPaymentCommand {
  readonly transactionId: string;
  readonly bookingId: string;
  readonly accountId: string;
  readonly amountCredits: number;
  readonly occurredAt: string;
}

export type BookingPaymentDisposition = 'confirmed' | 'compensated' | 'duplicate' | 'ignored';

export interface RecordBookingPaymentResult {
  readonly disposition: BookingPaymentDisposition;
}

/** Bad internal correlation is permanent; retrying cannot make identities agree. */
export class BookingPaymentMismatchError extends Error {
  constructor(reason = 'identity, learner, or amount mismatch') {
    super(`Wallet payment outcome does not match a local booking (${reason})`);
    this.name = 'BookingPaymentMismatchError';
  }
}

export interface RecordBookingPaymentPort {
  execute(command: RecordBookingPaymentCommand): Promise<RecordBookingPaymentResult>;
}
