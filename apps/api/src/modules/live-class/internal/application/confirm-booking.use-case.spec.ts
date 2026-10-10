import { ConfirmBookingUseCase } from './confirm-booking.use-case';
import type { BookingRepository, PersistedBooking } from './port/out/booking-repository';

function booking(state: PersistedBooking['state']): PersistedBooking {
  return {
    id: 'bkg-1',
    classId: 'cls-1',
    learnerId: 'st-1',
    state,
    priceCredits: 100,
    idempotencyKey: 'key-1',
    createdAt: new Date('2026-10-08T00:00:00.000Z'),
    expiresAt: new Date('2026-10-08T00:15:00.000Z'),
  };
}

function repo(confirmed: boolean, result: PersistedBooking | null): BookingRepository {
  return {
    findByIdempotencyKey: jest.fn(),
    findById: jest.fn(),
    createWithSeatGuard: jest.fn(),
    confirmAndEmit: jest.fn(async () => ({ confirmed, booking: result })),
    cancelAndEmit: jest.fn(async () => ({ cancelled: false, booking: null })),
    expirePendingHolds: jest.fn(async () => 0),
    countByClassAndState: jest.fn(async () => 0),
    findActiveByClass: jest.fn(async () => []),
  };
}

describe('ConfirmBookingUseCase (FR-009 / API-006)', () => {
  it('returns the confirmed booking with an ISO timestamp', async () => {
    const useCase = new ConfirmBookingUseCase(repo(true, booking('confirmed')));
    const result = await useCase.execute({ bookingId: 'bkg-1', learnerId: 'st-1' });
    expect(result.confirmed).toBe(true);
    expect(result.booking).toEqual({
      bookingId: 'bkg-1',
      classId: 'cls-1',
      learnerId: 'st-1',
      state: 'confirmed',
      priceCredits: 100,
      createdAt: '2026-10-08T00:00:00.000Z',
    });
  });

  it('reports a non-confirmable booking without throwing', async () => {
    const useCase = new ConfirmBookingUseCase(repo(false, booking('cancelled')));
    const result = await useCase.execute({ bookingId: 'bkg-1', learnerId: 'st-1' });
    expect(result.confirmed).toBe(false);
    expect(result.booking?.state).toBe('cancelled');
  });
});
