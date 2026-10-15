import type {
  BookClassResult,
  BookingGateway,
  ConfirmBookingResponse,
  OwnBookingSummaryView,
} from './domain';

/**
 * Application service for the learner booking flow (FR-007). Keeps the UI
 * presentation-only; the gateway is injected so mock and real are interchangeable.
 *
 * The flow is the same three moves everywhere it is used — book a seat, ask for
 * settlement, read back whether it landed — so the class detail action and the
 * checkout branch share this one path instead of issuing their own commands.
 */
export class BookClassService {
  constructor(private readonly gateway: BookingGateway) {}

  book(classId: string, idempotencyKey: string): Promise<BookClassResult> {
    return this.gateway.bookClass(classId, idempotencyKey);
  }

  confirm(bookingId: string): Promise<ConfirmBookingResponse> {
    return this.gateway.confirmBooking(bookingId);
  }

  /** The caller's hold on this class, or null — read before booking again. */
  ownBooking(classId: string): Promise<OwnBookingSummaryView | null> {
    return this.gateway.getOwnBooking(classId);
  }
}
