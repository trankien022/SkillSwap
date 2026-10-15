import {
  BookingError,
  type BookClassResult,
  type BookingGateway,
  type BookingView,
  type ClassView,
  type ConfirmBookingResponse,
  type OwnBookingSummaryView,
} from './domain';
import { demoClass } from './demo-class';

/**
 * Mock booking gateway (FR-007) — no network. It reproduces the backend
 * behaviour and response shapes so the UI can be built and tested before the
 * real HTTP adapter exists: idempotent replay by key, capacity counting, and
 * the backend's BookingError reasons.
 */
export class MockBookingGateway implements BookingGateway {
  private readonly bookings = new Map<string, BookingView>();
  private readonly byIdempotencyKey = new Map<string, string>();
  private sequence = 0;

  constructor(
    private readonly classes: ClassView[] = [demoClass()],
    private readonly learnerId = 'learner-demo',
  ) {}

  async getClass(classId: string): Promise<ClassView> {
    const found = this.classes.find((item) => item.id === classId);
    if (found !== undefined) {
      return found;
    }

    // No localStorage fallback: the cache key it read has no writers, and the
    // reconstructed class invented a teacher, price and capacity. An unknown id
    // is an error.
    throw new Error(`Class not found: ${classId}`);
  }

  async bookClass(classId: string, idempotencyKey: string): Promise<BookClassResult> {
    const replayId = this.byIdempotencyKey.get(idempotencyKey);
    if (replayId !== undefined) {
      const existing = this.bookings.get(replayId);
      if (existing !== undefined) {
        return { booking: existing, created: false };
      }
    }

    const classView = await this.getClass(classId);

    if (classView.state !== 'published') {
      throw new BookingError('class_not_bookable', `Class is not open (state: ${classView.state})`);
    }
    if (classView.teacherId === this.learnerId) {
      throw new BookingError('self_booking', 'A Teacher may not book their own class');
    }
    const leadTime = new Date(classView.startsAt).getTime() - Date.now();
    if (leadTime <= 0) {
      throw new BookingError('class_started', 'Class has already started');
    }
    if (leadTime < 24 * 60 * 60 * 1000) {
      throw new BookingError(
        'booking_window_closed',
        'A booking must be created at least 24 hours before class start',
      );
    }
    const active = [...this.bookings.values()].filter(
      (booking) =>
        booking.classId === classId && (booking.state === 'pending' || booking.state === 'confirmed'),
    );
    if (active.some((booking) => booking.learnerId === this.learnerId)) {
      throw new BookingError('duplicate_booking', 'Learner already has a valid booking');
    }
    if (active.length >= classView.capacity) {
      throw new BookingError('class_full', 'Class has no available seats');
    }

    const booking: BookingView = {
      bookingId: `bkg-${++this.sequence}`,
      classId,
      learnerId: this.learnerId,
      state: 'pending',
      priceCredits: classView.priceCredits,
      createdAt: new Date().toISOString(),
    };
    this.bookings.set(booking.bookingId, booking);
    this.byIdempotencyKey.set(idempotencyKey, booking.bookingId);
    return { booking, created: true };
  }

  /**
   * The mock settles immediately: the hold it knows about becomes `confirmed`
   * and the answer states the same fact a read-back would. An unknown booking
   * throws instead of answering `confirmed: true` for something that does not
   * exist — the one thing this flow must never fabricate.
   */
  async confirmBooking(bookingId: string): Promise<ConfirmBookingResponse> {
    const booking = this.bookings.get(bookingId);
    if (booking === undefined) {
      throw new Error(`Booking not found: ${bookingId}`);
    }
    const settled: BookingView =
      booking.state === 'confirmed' ? booking : { ...booking, state: 'confirmed' };
    this.bookings.set(bookingId, settled);
    return { confirmed: true, booking: settled };
  }

  async getOwnBooking(classId: string): Promise<OwnBookingSummaryView | null> {
    const own = [...this.bookings.values()].find(
      (booking) =>
        booking.classId === classId &&
        booking.learnerId === this.learnerId &&
        (booking.state === 'pending' || booking.state === 'confirmed'),
    );
    if (own === undefined) {
      return null;
    }
    // The mock issues no hold TTL, so it reports none rather than inventing a
    // countdown: `expiresAt: null` means "no deadline was set". The state is
    // stated explicitly because `BookingView.state` is an open string — a hold
    // is either pending or confirmed, and anything else is no hold at all.
    const state: 'pending' | 'confirmed' | null =
      own.state === 'pending' ? 'pending' : own.state === 'confirmed' ? 'confirmed' : null;
    if (state === null) {
      return null;
    }
    return { bookingId: own.bookingId, state, expiresAt: null };
  }
}

export { DEMO_CLASS_ID } from './demo-class';
