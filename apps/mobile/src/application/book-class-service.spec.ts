import { BookClassService } from '@/application/book-class-service';
import { MockBookingGateway, DEMO_CLASS_ID } from '@/infrastructure/mock/mock-booking-gateway';
import { demoClass } from '@/infrastructure/mock/demo-class';

function service() {
  return new BookClassService(new MockBookingGateway());
}

describe('BookClassService (FR-007)', () => {
  it('loads a known class and exposes the backend view fields', async () => {
    const classView = await service().loadClass(DEMO_CLASS_ID);
    expect(classView).toMatchObject({
      id: DEMO_CLASS_ID,
      state: 'published',
      priceCredits: 100,
      capacity: 2,
    });
  });

  it('rejects an unknown class so the screen can show a not-found state', async () => {
    await expect(service().loadClass('missing')).rejects.toThrow(/Class not found/);
  });

  it('delegates booking and returns the { booking, created } envelope', async () => {
    const result = await service().book(DEMO_CLASS_ID, 'key-1');
    expect(result.created).toBe(true);
    expect(result.booking.state).toBe('pending');
  });

  it('surfaces a BookingError with the backend reason', async () => {
    const gateway = new MockBookingGateway([{ ...demoClass(), capacity: 0 }]);
    const spy = new BookClassService(gateway);
    await expect(spy.book(DEMO_CLASS_ID, 'k')).rejects.toMatchObject({ reason: 'class_full' });
  });
});
