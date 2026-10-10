import { ExpirePendingBookingsUseCase } from './expire-pending-bookings.use-case';
import type { Clock } from './port/out/clock';
import { InMemoryBookingRepository, makeBooking } from './testing/live-class-fakes';

const NOW = new Date('2026-10-10T00:00:00.000Z');
const clock: Clock = { now: () => NOW };

describe('ExpirePendingBookingsUseCase (FR-007 / AC-026)', () => {
  it('cancels exactly the expired pending holds', async () => {
    const rows = [
      makeBooking({ id: 'a', state: 'pending', expiresAt: new Date(NOW.getTime() - 1000) }),
      makeBooking({ id: 'b', state: 'pending', expiresAt: new Date(NOW.getTime() + 1000) }),
      makeBooking({ id: 'c', state: 'confirmed', expiresAt: new Date(NOW.getTime() - 1000) }),
    ];
    const bookings = new InMemoryBookingRepository(rows);
    const result = await new ExpirePendingBookingsUseCase(bookings, clock).execute();
    expect(result.expired).toBe(1);
    expect(rows.map((r) => r.state)).toEqual(['cancelled', 'pending', 'confirmed']);
    expect(bookings.emitted).toEqual([{ event: 'booking.cancelled', bookingId: 'a', reason: 'expired' }]);
  });

  it('is idempotent on a second sweep', async () => {
    const rows = [makeBooking({ id: 'a', expiresAt: new Date(NOW.getTime() - 1000) })];
    const useCase = new ExpirePendingBookingsUseCase(new InMemoryBookingRepository(rows), clock);
    expect((await useCase.execute()).expired).toBe(1);
    expect((await useCase.execute()).expired).toBe(0);
  });
});
