import type { BookingGateway } from '@/application/port/booking-gateway';
import { BookingError, type BookingView, type ClassView } from '@/domain/booking/booking';
import { demoClass } from './demo-class';

/**
 * Mock booking gateway (FR-007) — no network. It reproduces the backend
 * behaviour and response shapes so the UI can be built and tested before the
 * real HTTP adapter exists: idempotent replay by key, capacity counting, and
 * the backend's `BookingError` reasons.
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
    if (found === undefined) {
      throw new Error(`Class not found: ${classId}`);
    }
    return found;
  }

  async bookClass(
    classId: string,
    idempotencyKey: string,
  ): Promise<{ booking: BookingView; created: boolean }> {
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
}

export { DEMO_CLASS_ID } from './demo-class';
