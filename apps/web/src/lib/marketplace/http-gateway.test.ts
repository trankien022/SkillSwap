import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpMarketplaceGateway } from './http-gateway';
import { DEFAULT_QUERY } from './types';

/**
 * `this-weekend` was silently a no-op here: the mock implements all three time filters, the HTTP
 * adapter implemented one (`next-24-48h`). Picking "this weekend" in the sidebar left the result
 * set untouched while the radio still rendered checked — a control that lies.
 *
 * These tests stub `fetch` the way `booking/http-gateway.test.ts` does, so the assertion is on
 * real filter behaviour rather than on a predicate called in isolation.
 */

const HOUR = 60 * 60 * 1000;

/** A fixed mid-week reference: Wednesday 2026-11-11 12:00 UTC. */
const NOW = new Date('2026-11-11T12:00:00.000Z');

function at(iso: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `class-${iso}`,
    teacherId: 'teacher-1',
    teacherDisplayName: 'Demo Teacher',
    verified: true,
    schoolName: 'FPT University',
    skillIds: ['skill-1'],
    title: 'Demo class',
    level: 'intermediate',
    format: 'one-on-one',
    description: 'Demo class',
    startsAt: iso,
    durationMinutes: 60,
    priceCredits: 100,
    capacity: 1,
    confirmedBookingsCount: 0,
    availableSeats: 1,
    state: 'published',
    averageRating: 4.5,
    ratingsCount: 2,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const CATALOGUE = {
  items: [
    {
      id: 'skill-1',
      name: 'Guitar',
      category: 'Music',
      levels: ['beginner'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  nextCursor: null,
};

/** Wed +34h, Sat +40h, Sun +64h, Mon +90h — only the middle two are weekend. */
const WED_ISH = new Date(NOW.getTime() + 34 * HOUR).toISOString();
const SAT = new Date('2026-11-14T04:00:00.000Z').toISOString(); // Saturday
const SUN = new Date('2026-11-15T04:00:00.000Z').toISOString(); // Sunday
const MON = new Date('2026-11-16T04:00:00.000Z').toISOString(); // Monday

function stub(items: ReturnType<typeof at>[]) {
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes('/skills')) return jsonResponse({ success: true, code: 'OK', message: 'OK', data: CATALOGUE, errors: [] });
    return jsonResponse({
      success: true,
      code: 'OK',
      message: 'OK',
      data: { items, nextCursor: null },
      errors: [],
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('HttpMarketplaceGateway time filters', () => {
  it('keeps only Saturday and Sunday classes for this-weekend', async () => {
    stub([at(WED_ISH), at(SAT), at(SUN), at(MON)]);

    const page = await new HttpMarketplaceGateway().search({
      ...DEFAULT_QUERY,
      timeFilter: 'this-weekend',
    });

    expect(page.items.map((i) => i.startsAt)).toEqual([SAT, SUN]);
  });

  it('does not treat every class as a weekend class', async () => {
    // The regression that mattered: the filter used to change nothing at all.
    stub([at(WED_ISH), at(MON)]);

    const page = await new HttpMarketplaceGateway().search({
      ...DEFAULT_QUERY,
      timeFilter: 'this-weekend',
    });

    expect(page.items).toEqual([]);
  });

  it('narrows next-24-48h to the 24-48h window, as before', async () => {
    stub([at(WED_ISH), at(SAT), at(SUN)]);

    const page = await new HttpMarketplaceGateway().search({
      ...DEFAULT_QUERY,
      timeFilter: 'next-24-48h',
    });

    expect(page.items.map((i) => i.startsAt)).toEqual([WED_ISH]);
  });

  it('leaves all-valid to the API, which already enforces the 24h lead time', async () => {
    stub([at(WED_ISH), at(SAT), at(SUN), at(MON)]);

    const page = await new HttpMarketplaceGateway().search({
      ...DEFAULT_QUERY,
      timeFilter: 'all-valid',
    });

    expect(page.items).toHaveLength(4);
  });

  it('excludes a weekend class that is inside the 24-hour booking window (BR-021)', async () => {
    const soonSaturday = new Date(NOW.getTime() + 2 * HOUR).toISOString(); // Wed +2h
    stub([at(soonSaturday)]);

    const page = await new HttpMarketplaceGateway().search({
      ...DEFAULT_QUERY,
      timeFilter: 'this-weekend',
    });

    expect(page.items).toEqual([]);
  });
});
