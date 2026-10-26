import { afterEach, describe, expect, it, vi } from 'vitest';
import { envelopeErr, envelopeOk } from '@skillswap/contracts';
import { HttpBookingGateway } from './http-gateway';
import { BookingError } from './domain';

/**
 * The adapter is the seam where a backend rejection `code` becomes a domain
 * `BookingError` the UI can translate. A wrong mapping here is invisible to the
 * panel tests (they inject a mock), so it is covered directly.
 */

const CLASS_ID = '11111111-1111-4111-8111-111111111111';
const IDEMPOTENCY_KEY = 'key-1';

const classDetail = {
  id: CLASS_ID,
  teacher: { id: 'teacher-1', displayName: 'Demo Teacher', averageRating: 4.5, ratingsCount: 2 },
  skillIds: ['skill-1'],
  description: 'Demo class',
  startsAt: '2030-01-01T10:00:00.000Z',
  durationMinutes: 60,
  priceCredits: 120,
  capacity: 8,
  availableSeats: 8,
  state: 'published',
  canBook: true,
  recentRatings: [],
};

const booking = {
  bookingId: 'booking-1',
  classId: CLASS_ID,
  learnerId: 'learner-1',
  state: 'pending',
  priceCredits: 120,
  createdAt: '2029-12-01T10:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpBookingGateway', () => {
  it('maps GET /classes/:id onto the ClassView the panel needs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(envelopeOk(classDetail)));
    vi.stubGlobal('fetch', fetchMock);

    const view = await new HttpBookingGateway().getClass(CLASS_ID);

    expect(fetchMock.mock.calls[0][0]).toContain(`/api/classes/${CLASS_ID}`);
    expect(view).toEqual({
      id: CLASS_ID,
      teacherId: 'teacher-1',
      state: 'published',
      startsAt: classDetail.startsAt,
      durationMinutes: 60,
      priceCredits: 120,
      capacity: 8,
    });
  });

  it('posts the booking to /classes/:id/bookings and returns the created flag', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(envelopeOk({ booking, created: true })));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new HttpBookingGateway().bookClass(CLASS_ID, IDEMPOTENCY_KEY);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/api/classes/${CLASS_ID}/bookings`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ idempotencyKey: IDEMPOTENCY_KEY });
    expect(init.headers['idempotency-key']).toBe(IDEMPOTENCY_KEY);
    expect(result.created).toBe(true);
    expect(result.booking.bookingId).toBe('booking-1');
  });

  it('surfaces an idempotent replay as created: false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(envelopeOk({ booking, created: false }))),
    );

    const result = await new HttpBookingGateway().bookClass(CLASS_ID, IDEMPOTENCY_KEY);

    expect(result.created).toBe(false);
  });

  it.each([
    'class_full',
    'duplicate_booking',
    'self_booking',
    'booking_window_closed',
    // AC-034 / BR-001: the trust gate must reach the UI as a translated reason.
    'learner_not_verified',
  ])(
    'maps the backend code %s onto the matching BookingError reason',
    async (code) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse(envelopeErr(code, 'rejected'), 409)),
      );

      await expect(new HttpBookingGateway().bookClass(CLASS_ID, IDEMPOTENCY_KEY)).rejects.toThrow(
        BookingError,
      );

      try {
        await new HttpBookingGateway().bookClass(CLASS_ID, IDEMPOTENCY_KEY);
      } catch (error) {
        expect((error as BookingError).reason).toBe(code);
      }
    },
  );

  it('posts the confirm to /classes/bookings/:id/confirm and returns the reply as data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(envelopeOk({ confirmed: false, booking })));
    vi.stubGlobal('fetch', fetchMock);

    const reply = await new HttpBookingGateway().confirmBooking('booking-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/classes/bookings/booking-1/confirm');
    expect(init.method).toBe('POST');
    // `confirmed: false` is a legitimate answer while the debit settles, so it
    // parses into data instead of being thrown or believed as success.
    expect(reply.confirmed).toBe(false);
    expect(reply.booking?.bookingId).toBe('booking-1');
  });

  it("reads the caller's own hold from GET /classes/:id, or null when they have none", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(envelopeOk(classDetail))));
    expect(await new HttpBookingGateway().getOwnBooking(CLASS_ID)).toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          envelopeOk({
            ...classDetail,
            ownBooking: {
              bookingId: 'booking-1',
              state: 'pending',
              expiresAt: '2029-12-01T10:15:00.000Z',
            },
          }),
        ),
      ),
    );
    const hold = await new HttpBookingGateway().getOwnBooking(CLASS_ID);
    expect(hold).toMatchObject({ bookingId: 'booking-1', state: 'pending' });
  });

  it('degrades an unknown code to class_not_bookable instead of throwing a raw error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(envelopeErr('some_new_code', 'nope'), 409)),
    );

    await expect(
      new HttpBookingGateway().bookClass(CLASS_ID, IDEMPOTENCY_KEY),
    ).rejects.toMatchObject({ name: 'BookingError', reason: 'class_not_bookable' });
  });
});
