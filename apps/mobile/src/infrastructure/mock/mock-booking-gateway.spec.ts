import { BookClassService } from '@/application/book-class-service';
import { BookingError } from '@/domain/booking/booking';
import { MockBookingGateway, DEMO_CLASS_ID } from '@/infrastructure/mock/mock-booking-gateway';
import { demoClass } from '@/infrastructure/mock/demo-class';

function service() {
  return new BookClassService(new MockBookingGateway());
}

describe('MockBookingGateway booking flow (FR-007)', () => {
  it('creates a pending booking that mirrors the backend envelope', async () => {
    const result = await service().book(DEMO_CLASS_ID, 'key-1');
    expect(result.created).toBe(true);
    expect(result.booking).toMatchObject({
      bookingId: 'bkg-1',
      classId: DEMO_CLASS_ID,
      learnerId: 'learner-demo',
      state: 'pending',
      priceCredits: 100,
    });
    expect(typeof result.booking.createdAt).toBe('string');
  });

  it('replays the same idempotency key without creating a second booking', async () => {
    const svc = service();
    const first = await svc.book(DEMO_CLASS_ID, 'same');
    const second = await svc.book(DEMO_CLASS_ID, 'same');
    expect(second.created).toBe(false);
    expect(second.booking.bookingId).toBe(first.booking.bookingId);
  });

  it('rejects a duplicate booking by the same learner (BR-024)', async () => {
    const svc = service();
    await svc.book(DEMO_CLASS_ID, 'k1');
    await expect(svc.book(DEMO_CLASS_ID, 'k2')).rejects.toMatchObject({
      reason: 'duplicate_booking',
    });
  });

  it('rejects a class inside the 24-hour window (AC-003)', async () => {
    const gateway = new MockBookingGateway([
      { ...demoClass(), id: 'soon', startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
    ]);
    await expect(gateway.bookClass('soon', 'k')).rejects.toBeInstanceOf(BookingError);
    await expect(gateway.bookClass('soon', 'k')).rejects.toMatchObject({
      reason: 'booking_window_closed',
    });
  });

  it('rejects a full class (AC-010, BR-025)', async () => {
    const gateway = new MockBookingGateway([{ ...demoClass(), capacity: 0 }]);
    await expect(gateway.bookClass(DEMO_CLASS_ID, 'k')).rejects.toMatchObject({
      reason: 'class_full',
    });
  });
});
