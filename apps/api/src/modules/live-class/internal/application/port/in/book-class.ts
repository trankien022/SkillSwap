export const BOOK_CLASS = Symbol('BOOK_CLASS');

/** FR-007 / API-005: create a pending booking that holds a seat. */
export interface BookClassCommand {
  classId: string;
  learnerId: string;
  idempotencyKey: string;
}

export interface BookingResource {
  bookingId: string;
  classId: string;
  learnerId: string;
  state: string;
  priceCredits: number;
  createdAt: string;
}

export interface BookClassResult {
  booking: BookingResource;
  /** False when an idempotent replay returned the previously created booking. */
  created: boolean;
}

export interface BookClassPort {
  execute(command: BookClassCommand): Promise<BookClassResult>;
}
