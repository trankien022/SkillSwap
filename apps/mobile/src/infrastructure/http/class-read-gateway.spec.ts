import type { MobileConfig } from '../config';
import { ClassReadGateway } from './class-read-gateway';
import { GatewayClient, GatewayHttpError, type SessionTokenProvider } from './gateway-client';

describe('ClassReadGateway', () => {
  const config: MobileConfig = {
    gatewayBaseUrl: 'http://localhost:4000',
    apiBaseUrl: 'http://localhost:4000/api',
  };

  const sampleClassItem = {
    id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    teacherId: '123e4567-e89b-12d3-a456-426614174000',
    teacherDisplayName: 'Nguyễn Văn A',
    skillIds: [
      'e7b0a708-3011-4f16-9d32-2339c1b74737',
      '550e8400-e29b-41d4-a716-446655440000',
    ],
    description: 'Nhập môn lập trình TypeScript nâng cao',
    startsAt: '2026-10-20T10:00:00.000Z',
    durationMinutes: 60,
    priceCredits: 50,
    capacity: 10,
    confirmedBookingsCount: 2,
    availableSeats: 8,
    state: 'published' as const,
    averageRating: 4.8,
    ratingsCount: 5,
  };

  const sampleClassesPage = {
    items: [sampleClassItem],
    nextCursor: 'eyJzdGFydHNBdCI6IjIwMjYtMTAtMjBUMTA6MDA6MDAuMDAwWiIsImlkIjoiY2xhc3MtdXVpZC0xIn0',
    totalActiveTeachingCount: 1,
  };

  const sampleSkillItem1 = {
    id: 'e7b0a708-3011-4f16-9d32-2339c1b74737',
    name: 'TypeScript',
    category: 'Lập trình',
    levels: ['beginner', 'intermediate', 'advanced', 'expert'] as const,
  };

  const sampleSkillItem2 = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'React Native',
    category: 'Mobile',
    levels: ['beginner', 'intermediate', 'advanced', 'expert'] as const,
  };

  let mockFetch: jest.Mock;
  let mockTokenProvider: jest.Mocked<SessionTokenProvider>;
  let gatewayClient: GatewayClient;
  let classReadGateway: ClassReadGateway;

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
    classReadGateway = new ClassReadGateway(gatewayClient);
  });

  describe('getClassesPage', () => {
    it('fetches default classes page without query params when options are empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleClassesPage,
      });

      const result = await classReadGateway.getClassesPage();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:4000/api/classes');
      expect(init.method).toBe('GET');
      expect(init.headers['Authorization']).toBe('Bearer test-access-token');
      expect(result).toEqual(sampleClassesPage);
    });

    it('encodes query params with URLSearchParams and avoids serializing undefined fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleClassesPage,
      });

      const result = await classReadGateway.getClassesPage({
        keyword: '  typescript search  ',
        skillId: 'e7b0a708-3011-4f16-9d32-2339c1b74737',
        limit: 20,
        cursor: 'cursor-token',
        state: 'published',
        startDate: '2026-10-20T00:00:00.000Z',
        endDate: '2026-10-25T00:00:00.000Z',
        teacherId: 'me',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      const parsedUrl = new URL(url);

      expect(parsedUrl.pathname).toBe('/api/classes');
      expect(parsedUrl.searchParams.get('q')).toBe('typescript search');
      // The legacy `keyword` alias is never sent; `q` is the canonical name.
      expect(parsedUrl.searchParams.has('keyword')).toBe(false);
      expect(parsedUrl.searchParams.get('skillId')).toBe('e7b0a708-3011-4f16-9d32-2339c1b74737');
      expect(parsedUrl.searchParams.get('limit')).toBe('20');
      expect(parsedUrl.searchParams.get('cursor')).toBe('cursor-token');
      expect(parsedUrl.searchParams.get('state')).toBe('published');
      expect(parsedUrl.searchParams.get('startDate')).toBe('2026-10-20T00:00:00.000Z');
      expect(parsedUrl.searchParams.get('endDate')).toBe('2026-10-25T00:00:00.000Z');
      expect(parsedUrl.searchParams.get('teacherId')).toBe('me');

      expect(parsedUrl.search).not.toContain('undefined');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].teacherDisplayName).toBe('Nguyễn Văn A');
      expect(result.totalActiveTeachingCount).toBe(1);
    });

    it('rejects with ZodError when backend response violates listClassesPageSchema', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [{ id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' }],
          nextCursor: null,
        }),
      });

      await expect(classReadGateway.getClassesPage()).rejects.toMatchObject({ name: 'ZodError' });
    });

    it('propagates GatewayHttpError from GatewayClient when HTTP 403 occurs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          statusCode: 403,
          message: 'Access denied for caller',
        }),
      });

      await expect(classReadGateway.getClassesPage({ teacherId: 'me' })).rejects.toThrow(
        GatewayHttpError,
      );
    });
  });

  describe('getSkillsPage', () => {
    it('fetches skills catalogue page with exact 4-enum level schema validation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [sampleSkillItem1, sampleSkillItem2],
          nextCursor: 'next-skills-cursor',
        }),
      });

      const page = await classReadGateway.getSkillsPage({
        category: 'Lập trình',
        keyword: 'Type',
        limit: 50,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(page.items).toHaveLength(2);
      expect(page.items[0].levels).toEqual(['beginner', 'intermediate', 'advanced', 'expert']);
      expect(page.nextCursor).toBe('next-skills-cursor');
    });

    it('rejects with ZodError when levels contain invalid non-enum value', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'e7b0a708-3011-4f16-9d32-2339c1b74737',
              name: 'Invalid Skill',
              category: 'Cat',
              levels: ['master'],
            },
          ],
          nextCursor: null,
        }),
      });

      await expect(classReadGateway.getSkillsPage()).rejects.toMatchObject({ name: 'ZodError' });
    });
  });

  describe('getAllSkills (bounded multi-page pagination with cycle detection)', () => {
    it('signals complete when catalogue completes within bounded pages', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ items: [sampleSkillItem1], nextCursor: 'cursor-page-2' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ items: [sampleSkillItem2], nextCursor: null }),
        });

      const result = await classReadGateway.getAllSkills(5, 50);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.items).toHaveLength(2);
      expect(result.isComplete).toBe(true);
      expect(result.nextCursor).toBeNull();
    });

    it('signals incomplete and exposes nextCursor when maxPages is reached', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: [sampleSkillItem1], nextCursor: 'cursor-page-next' }),
      });

      const result = await classReadGateway.getAllSkills(2, 50);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.isComplete).toBe(false);
      expect(result.nextCursor).toBe('cursor-page-next');
      expect(result.items).toHaveLength(1); // sampleSkillItem1 deduped by ID
    });

    it('safely breaks and signals incomplete if server repeats previous cursor', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items: [sampleSkillItem1], nextCursor: 'looping-cursor' }),
      });

      const result = await classReadGateway.getAllSkills(5, 50);

      // Attempt 1: receives looping-cursor
      // Attempt 2: requests with looping-cursor, sees looping-cursor again -> breaks
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.isComplete).toBe(false);
      expect(result.nextCursor).toBeNull();
    });
  });
});
