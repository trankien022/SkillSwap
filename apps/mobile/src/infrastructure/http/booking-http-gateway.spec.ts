import { SessionExpiredRetryRequiredError } from '@/application/port/session-types';
import type { MobileConfig } from '../config';
import { BookingHttpGateway } from './booking-http-gateway';
import { GatewayClient, GatewayHttpError, type SessionTokenProvider } from './gateway-client';

describe('BookingHttpGateway', () => {
  const config: MobileConfig = {
    gatewayBaseUrl: 'http://localhost:4000',
    apiBaseUrl: 'http://localhost:4000/api',
  };

  const sampleClassDetail = {
    id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    teacher: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      displayName: 'Trần Văn Giáo Viên',
      averageRating: 4.9,
      ratingsCount: 12,
    },
    skillIds: ['e7b0a708-3011-4f16-9d32-2339c1b74737'],
    description: 'Lớp học lập trình chuyên sâu React Native & TypeORM',
    startsAt: '2026-10-25T14:00:00.000Z',
    durationMinutes: 90,
    priceCredits: 100,
    capacity: 15,
    availableSeats: 5,
    state: 'published' as const,
    canBook: true,
    recentRatings: [
      {
        id: 'rating-1',
        learnerDisplayName: 'Lê Học Viên',
        stars: 5,
        comment: 'Giảng viên hướng dẫn rất chi tiết và dễ hiểu.',
        createdAt: '2026-10-20T08:00:00.000Z',
      },
    ],
    ownBooking: null,
  };

  const sampleBookingView = {
    bookingId: 'booking-uuid-1',
    classId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    learnerId: 'learner-uuid-1',
    state: 'pending',
    priceCredits: 100,
    createdAt: '2026-10-22T09:00:00.000Z',
  };

  let mockFetch: jest.Mock;
  let mockTokenProvider: jest.Mocked<SessionTokenProvider>;
  let gatewayClient: GatewayClient;
  let bookingHttpGateway: BookingHttpGateway;

  beforeEach(() => {
    mockFetch = jest.fn();
    mockTokenProvider = {
      getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
      refreshSession: jest.fn().mockResolvedValue({
        tokens: { accessToken: 'refreshed-token' },
      }),
    };
    gatewayClient = new GatewayClient(config, {
      fetchFn: mockFetch as unknown as typeof fetch,
      tokenProvider: mockTokenProvider,
    });
    bookingHttpGateway = new BookingHttpGateway(gatewayClient);
  });

  describe('getClassDetail', () => {
    it('fetches class detail with authenticated path and validates classDetailViewSchema', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleClassDetail,
      });

      const result = await bookingHttpGateway.getClassDetail('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:4000/api/classes/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
      expect(init.method).toBe('GET');
      expect(init.headers['Authorization']).toBe('Bearer test-access-token');
      expect(result).toEqual(sampleClassDetail);
    });

    it('URL-encodes the class id when requesting dedicated detail', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleClassDetail,
      });

      await bookingHttpGateway.getClassDetail('class/id');

      expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:4000/api/classes/class%2Fid');
      expect(mockFetch.mock.calls[0][1].method).toBe('GET');
    });

    it('preserves the backend draft state and booking eligibility in the parsed detail', async () => {
      const draft = { ...sampleClassDetail, state: 'draft' as const, canBook: false };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => draft,
      });

      const result = await bookingHttpGateway.getClassDetail(draft.id);

      expect(result.state).toBe('draft');
      expect(result.canBook).toBe(false);
    });

    it('rejects with ZodError when backend response violates classDetailViewSchema', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'invalid-class-missing-fields',
        }),
      });

      await expect(
        bookingHttpGateway.getClassDetail('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'),
      ).rejects.toMatchObject({ name: 'ZodError' });
    });

    it('propagates 404 GatewayHttpError when class does not exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          statusCode: 404,
          message: 'Class not found: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        }),
      });

      await expect(
        bookingHttpGateway.getClassDetail('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'),
      ).rejects.toThrow(GatewayHttpError);
    });

    it('retries GET once on 401 via GatewayClient token refresh', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ statusCode: 401, message: 'Access token expired' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => sampleClassDetail,
        });

      const result = await bookingHttpGateway.getClassDetail('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockTokenProvider.refreshSession).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[1][1].headers['Authorization']).toBe('Bearer refreshed-token');
      expect(result).toEqual(sampleClassDetail);
    });
  });

  describe('bookClass', () => {
    it('sends POST to /classes/:id/bookings with body { idempotencyKey } and x-idempotency-key header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          booking: sampleBookingView,
          created: true,
        }),
      });

      const result = await bookingHttpGateway.bookClass(
        '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        'idem-key-abc-123',
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:4000/api/classes/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/bookings');
      expect(init.method).toBe('POST');
      expect(init.headers['Authorization']).toBe('Bearer test-access-token');
      expect(init.headers['x-idempotency-key']).toBe('idem-key-abc-123');
      expect(JSON.parse(init.body)).toEqual({ idempotencyKey: 'idem-key-abc-123' });
      expect(result).toEqual({
        booking: sampleBookingView,
        created: true,
      });
    });

    it('rejects with ZodError when response does not match { booking, created } schema', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          booking: { invalid: 'shape' },
          created: 'not-a-boolean',
        }),
      });

      await expect(
        bookingHttpGateway.bookClass('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 'idem-key-1'),
      ).rejects.toMatchObject({ name: 'ZodError' });
    });

    it('never automatically replays POST on 401; throws SessionExpiredRetryRequiredError immediately', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ statusCode: 401, message: 'Session expired' }),
      });

      const bookPromise = bookingHttpGateway.bookClass(
        '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        'idem-key-401',
      );

      await expect(bookPromise).rejects.toThrow(SessionExpiredRetryRequiredError);
      await expect(bookPromise).rejects.toMatchObject({
        requiresReconciliation: true,
      });

      // Crucial: exactly 1 request sent, NO automatic retry
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockTokenProvider.refreshSession).not.toHaveBeenCalled();
    });

    it('propagates GatewayHttpError with statusCode 0 on network rejection', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch: network unreachable'));

      await expect(
        bookingHttpGateway.bookClass('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 'idem-key-net'),
      ).rejects.toMatchObject({
        name: 'GatewayHttpError',
        statusCode: 0,
      });
    });
  });

  describe('confirmBooking / confirm', () => {
    it('sends POST to /classes/bookings/:bookingId/confirm with no body and parses confirmed response', async () => {
      const confirmedBooking = {
        ...sampleBookingView,
        state: 'confirmed',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          confirmed: true,
          booking: confirmedBooking,
        }),
      });

      const result = await bookingHttpGateway.confirmBooking('booking-uuid-1');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:4000/api/classes/bookings/booking-uuid-1/confirm');
      expect(init.method).toBe('POST');
      expect(init.headers['Authorization']).toBe('Bearer test-access-token');
      expect(init.body).toBeUndefined();
      expect(result).toEqual({
        confirmed: true,
        booking: confirmedBooking,
      });
    });

    it('parses unconfirmed response with null booking (confirmed: false, booking: null) without fake success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          confirmed: false,
          booking: null,
        }),
      });

      const result = await bookingHttpGateway.confirm('booking-uuid-1');

      expect(result).toEqual({
        confirmed: false,
        booking: null,
      });
    });

    it('parses unconfirmed response with existing pending booking (confirmed: false, booking: pending)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          confirmed: false,
          booking: sampleBookingView,
        }),
      });

      const result = await bookingHttpGateway.confirm('booking-uuid-1');

      expect(result).toEqual({
        confirmed: false,
        booking: sampleBookingView,
      });
      expect(result.confirmed).toBe(false);
    });

    it('never automatically replays confirm POST on 401; throws SessionExpiredRetryRequiredError', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ statusCode: 401, message: 'Session expired during confirm' }),
      });

      const confirmPromise = bookingHttpGateway.confirmBooking('booking-uuid-1');

      await expect(confirmPromise).rejects.toThrow(SessionExpiredRetryRequiredError);
      await expect(confirmPromise).rejects.toMatchObject({
        requiresReconciliation: true,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockTokenProvider.refreshSession).not.toHaveBeenCalled();
    });

    it('propagates GatewayHttpError with statusCode 0 on network rejection during confirm', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Network down'));

      await expect(bookingHttpGateway.confirmBooking('booking-uuid-1')).rejects.toMatchObject({
        name: 'GatewayHttpError',
        statusCode: 0,
      });
    });
  });
});
