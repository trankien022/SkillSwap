import { afterEach, describe, expect, it, vi } from 'vitest';
import { envelopeOk } from '@skillswap/contracts';
import { DashboardAuthError, HttpLearnerDashboardGateway } from './http-gateway';

/**
 * The dashboard composes two real endpoints into one snapshot. The composition
 * (which request feeds which field, and what is derived) has no other guard, so
 * it is pinned here against stubbed responses.
 */

const FUTURE = new Date(Date.now() + 48 * 3_600_000).toISOString();
const PAST = new Date(Date.now() - 48 * 3_600_000).toISOString();

function bookingItem(overrides: Record<string, unknown> = {}) {
  return {
    bookingId: 'bkg-0001',
    classId: 'cls-0001',
    state: 'confirmed',
    priceCredits: 60,
    createdAt: PAST,
    expiresAt: null,
    classSummary: {
      description: 'IELTS speaking',
      skillIds: ['skill-1'],
      startsAt: FUTURE,
      durationMinutes: 60,
      teacherId: 'teacher-1',
      teacherDisplayName: 'Lan Pham',
      classState: 'published',
    },
    roomAccessEligible: true,
    ratingEligible: false,
    hasRated: false,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** Routes by URL so a single stub serves the two-endpoint composition. */
function stubApi(map: {
  bookings?: unknown;
  balance?: unknown;
  postStatus?: Record<string, number>;
}) {
  const fetchMock = vi.fn((url: string) => {
    if (url.includes('/classes/bookings/me')) {
      return Promise.resolve(jsonResponse(envelopeOk(map.bookings)));
    }
    if (url.includes('/wallet/balance')) {
      return Promise.resolve(jsonResponse(envelopeOk(map.balance)));
    }
    const status = map.postStatus?.[url.split('/api')[1] ?? ''] ?? 200;
    return Promise.resolve(jsonResponse(envelopeOk({ ok: true }), status));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpLearnerDashboardGateway', () => {
  it('builds the snapshot from the bookings and wallet endpoints', async () => {
    const fetchMock = stubApi({
      bookings: { items: [bookingItem()], nextCursor: null, totalUpcomingCount: 1 },
      balance: { availableCredits: 150, pendingCredits: 60 },
    });

    const snapshot = await new HttpLearnerDashboardGateway().getSnapshot();

    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes('/classes/bookings/me'))).toBe(true);
    expect(urls.some((u) => u.includes('/wallet/balance'))).toBe(true);

    expect(snapshot.bookings).toHaveLength(1);
    expect(snapshot.bookings[0]?.state).toBe('upcoming');
    expect(snapshot.metrics.upcomingCount).toBe(1);
    // Escrow comes from the ledger's pending credits, not a guessed figure.
    expect(snapshot.metrics.escrowHeldCredits).toBe(60);
    expect(snapshot.wallet).toEqual({
      availableCredits: 150,
      heldCredits: 60,
      totalCredits: 210,
      vndRate: 1000,
    });
  });

  it('counts pending reviews from the server eligibility flags', async () => {
    stubApi({
      bookings: {
        items: [
          bookingItem({ state: 'completed', ratingEligible: true, hasRated: false }),
          bookingItem({ bookingId: 'bkg-0002', state: 'completed', ratingEligible: true, hasRated: true }),
        ],
        nextCursor: null,
        totalUpcomingCount: 0,
      },
      balance: { availableCredits: 0, pendingCredits: 0 },
    });

    const snapshot = await new HttpLearnerDashboardGateway().getSnapshot();

    expect(snapshot.metrics.pendingReviewCount).toBe(1);
  });

  it('throws DashboardAuthError when the bookings endpoint is unauthorized', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes('/classes/bookings/me')
            ? jsonResponse({ success: false, code: 'Unauthorized', message: 'nope', data: null, errors: [] }, 401)
            : jsonResponse(envelopeOk({ availableCredits: 0, pendingCredits: 0 })),
        ),
      ),
    );

    await expect(new HttpLearnerDashboardGateway().getSnapshot()).rejects.toBeInstanceOf(
      DashboardAuthError,
    );
  });

  it('reports a session as authenticated only when a token is present', () => {
    expect(new HttpLearnerDashboardGateway().isAuthenticated()).toBe(false);
  });
});
