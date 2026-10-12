import type { MobileConfig } from '../config';
import { GatewayClient, GatewayHttpError, type SessionTokenProvider } from './gateway-client';
import { MyBookingsGateway, type MyBookingsQueryOptions } from './my-bookings-gateway';
import {
  encodeBookingCursor,
  type LearnerBookingItemView,
  type MyBookingsPageView,
} from '@skillswap/contracts';

describe('MyBookingsGateway', () => {
  const config: MobileConfig = {
    gatewayBaseUrl: 'http://localhost:4000',
    apiBaseUrl: 'http://localhost:4000/api',
  };

  const sampleBookingItem: LearnerBookingItemView = {
    bookingId: '123e4567-e89b-12d3-a456-426614174000',
    classId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    state: 'confirmed',
    priceCredits: 100,
    createdAt: '2026-10-12T00:00:00.000Z',
    expiresAt: null,
    classSummary: {
      description: 'Khóa học lập trình di động React Native chuyên sâu',
      skillIds: ['550e8400-e29b-41d4-a716-446655440000'],
      startsAt: '2026-10-20T10:00:00.000Z',
      durationMinutes: 60,
      teacherId: 'teacher-uuid-1',
      teacherDisplayName: 'Nguyễn Văn A',
      classState: 'published',
    },
    roomAccessEligible: true,
    ratingEligible: false,
    hasRated: false,
  };

  const sampleBookingsPage: MyBookingsPageView = {
    items: [sampleBookingItem],
    nextCursor: 'eyJzdGFydHNBdCI6IjIwMjYtMTAtMjBUMTA6MDA6MDAuMDAwWiIsImlkIjoiMTIzZTQ1NjctZTg5Yi0xMmQzLWE0NTYtNDI2NjE0MTc0MDAwIn0',
    totalUpcomingCount: 5,
  };

  let mockFetch: jest.Mock;
  let mockTokenProvider: jest.Mocked<SessionTokenProvider>;
  let gatewayClient: GatewayClient;
  let myBookingsGateway: MyBookingsGateway;

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
    myBookingsGateway = new MyBookingsGateway(gatewayClient);
  });

  describe('getMyBookingsPage', () => {
    it('requests default /classes/bookings/me path without query parameters when options are omitted', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleBookingsPage,
      });

      const result = await myBookingsGateway.getMyBookingsPage();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:4000/api/classes/bookings/me');
      expect(init.method).toBe('GET');
      expect(init.headers['Authorization']).toBe('Bearer test-access-token');
      expect(result).toEqual(sampleBookingsPage);

    });

    it('excludes learnerId, owner, or auth metadata override params from query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleBookingsPage,
      });

      const rogueOptions = {
        state: 'confirmed' as const,
        learnerId: 'other-learner-id',
        owner: 'override-owner',
        studentId: 'rogue-student',
      };

      await myBookingsGateway.getMyBookingsPage(rogueOptions as unknown as MyBookingsQueryOptions);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      const parsedUrl = new URL(url);

      expect(parsedUrl.pathname).toBe('/api/classes/bookings/me');
      expect(parsedUrl.searchParams.get('state')).toBe('confirmed');
      expect(parsedUrl.searchParams.has('learnerId')).toBe(false);
      expect(parsedUrl.searchParams.has('owner')).toBe(false);
      expect(parsedUrl.searchParams.has('studentId')).toBe(false);
      expect(url).not.toContain('learnerId');
      expect(url).not.toContain('override-owner');
      expect(url).not.toContain('rogue-student');
    });

    it('explicitly preserves upcoming=false in query, and omits parameter when undefined', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleBookingsPage,
      });

      // 1. Explicitly false: must serialize to 'upcoming=false'
      await myBookingsGateway.getMyBookingsPage({ upcoming: false });
      let [url] = mockFetch.mock.calls[0];
      let parsedUrl = new URL(url);
      expect(parsedUrl.searchParams.get('upcoming')).toBe('false');
      expect(parsedUrl.search).toBe('?upcoming=false');

      // 2. Omitted / undefined: parameter must be absent from query
      await myBookingsGateway.getMyBookingsPage({ upcoming: undefined });
      [url] = mockFetch.mock.calls[1];
      parsedUrl = new URL(url);
      expect(parsedUrl.searchParams.has('upcoming')).toBe(false);
      expect(parsedUrl.search).toBe('');

      // 3. Explicitly true: serialized to 'upcoming=true'
      await myBookingsGateway.getMyBookingsPage({ upcoming: true });
      [url] = mockFetch.mock.calls[2];
      parsedUrl = new URL(url);
      expect(parsedUrl.searchParams.get('upcoming')).toBe('true');
      expect(parsedUrl.search).toBe('?upcoming=true');
    });

    it('properly encodes keyset cursor in query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleBookingsPage,
      });

      const validCursor = encodeBookingCursor(['2026-10-20T10:00:00.000Z', '123e4567-e89b-12d3-a456-426614174000']);
      await myBookingsGateway.getMyBookingsPage({
        cursor: `  ${validCursor}  `,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      const parsedUrl = new URL(url);

      expect(parsedUrl.searchParams.get('cursor')).toBe(validCursor);
      expect(parsedUrl.search).toContain(`cursor=${validCursor}`);
    });

    it('encodes cursor with special characters and serializes combined query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleBookingsPage,
      });

      const rawCursor = 'cursor+with/equals==&special';
      await myBookingsGateway.getMyBookingsPage({
        state: 'pending',
        upcoming: false,
        limit: 10,
        cursor: rawCursor,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      const parsedUrl = new URL(url);

      expect(parsedUrl.pathname).toBe('/api/classes/bookings/me');
      expect(parsedUrl.searchParams.get('state')).toBe('pending');
      expect(parsedUrl.searchParams.get('upcoming')).toBe('false');
      expect(parsedUrl.searchParams.get('limit')).toBe('10');
      expect(parsedUrl.searchParams.get('cursor')).toBe(rawCursor);
      // '=' characters are safely percent-encoded as %3D
      expect(url).toContain('%3D%3D');
    });

    it('preserves exact totalUpcomingCount from server when count > page.length and preserves eligibility flags', async () => {
      const singleItemPage: MyBookingsPageView = {
        items: [
          {
            ...sampleBookingItem,
            roomAccessEligible: true,
            ratingEligible: true,
            hasRated: false,
          },
        ],
        nextCursor: 'next-page-cursor',
        totalUpcomingCount: 42, // strictly greater than items.length (1)
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => singleItemPage,
      });

      const result = await myBookingsGateway.getMyBookingsPage({ limit: 1 });

      expect(result.items).toHaveLength(1);
      expect(result.totalUpcomingCount).toBe(42);
      expect(result.totalUpcomingCount).not.toBe(result.items.length);
      expect(result.items[0].roomAccessEligible).toBe(true);
      expect(result.items[0].ratingEligible).toBe(true);
      expect(result.items[0].hasRated).toBe(false);
      expect(result.nextCursor).toBe('next-page-cursor');
    });

    it('rejects with ZodError when backend response violates myBookingsPageSchema without direct zod dependency', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ bookingId: 'malformed-item' }],
          nextCursor: null,
          totalUpcomingCount: 1,
        }),
      });

      await expect(myBookingsGateway.getMyBookingsPage()).rejects.toMatchObject({
        name: 'ZodError',
      });
    });

    it('retries GET request exactly once after refreshing session token on HTTP 401', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({
            statusCode: 401,
            message: 'Token expired',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => sampleBookingsPage,
        });

      const result = await myBookingsGateway.getMyBookingsPage();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockTokenProvider.refreshSession).toHaveBeenCalledTimes(1);

      const [firstUrl, firstInit] = mockFetch.mock.calls[0];
      expect(firstUrl).toBe('http://localhost:4000/api/classes/bookings/me');
      expect(firstInit.headers['Authorization']).toBe('Bearer test-access-token');

      const [secondUrl, secondInit] = mockFetch.mock.calls[1];
      expect(secondUrl).toBe('http://localhost:4000/api/classes/bookings/me');
      expect(secondInit.headers['Authorization']).toBe('Bearer refreshed-token');

      expect(result).toEqual(sampleBookingsPage);
    });

    it('propagates GatewayHttpError without retrying when HTTP 403 occurs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          statusCode: 403,
          message: 'Access denied for caller',
        }),
      });

      await expect(myBookingsGateway.getMyBookingsPage()).rejects.toThrow(GatewayHttpError);
      expect(mockTokenProvider.refreshSession).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
