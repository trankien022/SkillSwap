import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_PATH, envelopeOk } from '@skillswap/contracts';
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
      title: 'IELTS speaking',
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
    const status = map.postStatus?.[url.split(API_BASE_PATH)[1] ?? ''] ?? 200;
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

  it('carries the server rating gate through to the view model', async () => {
    stubApi({
      bookings: {
        items: [
          bookingItem({ state: 'completed', ratingEligible: true, hasRated: false }),
          bookingItem({ bookingId: 'bkg-0002', state: 'completed', ratingEligible: false, hasRated: false }),
        ],
        nextCursor: null,
        totalUpcomingCount: 0,
      },
      balance: { availableCredits: 0, pendingCredits: 0 },
    });

    const snapshot = await new HttpLearnerDashboardGateway().getSnapshot();

    // The UI must not offer a review the API will refuse.
    expect(snapshot.bookings.map((b) => b.ratingEligible)).toEqual([true, false]);
  });

  describe('submitReview', () => {
    it('posts the rating without touching the settlement-confirm route', async () => {
      // A booking whose class is over but whose booking is still `confirmed`:
      // exactly the state the review modal opens in. `/confirm` used to be called
      // here and silently no-opped, which is why the button looked dead.
      const fetchMock = stubApi({
        bookings: { items: [bookingItem()], nextCursor: null, totalUpcomingCount: 1 },
        balance: { availableCredits: 150, pendingCredits: 60 },
      });

      await new HttpLearnerDashboardGateway().submitReview('bkg-0001', {
        rating: 5,
        body: 'Clear explanations.',
      });

      const urls = fetchMock.mock.calls.map((c) => c[0] as string);
      expect(urls.some((u) => u.includes('/bkg-0001/rating'))).toBe(true);
      expect(urls.some((u) => u.includes('/bkg-0001/confirm'))).toBe(false);
    });

    it('submits a rating even when the learner wrote no comment', async () => {
      // The guard used to be `if (body.trim().length > 0)`, so a bare star
      // rating was never sent and every silent reviewer counted as unreviewed.
      const fetchMock = stubApi({
        bookings: { items: [bookingItem()], nextCursor: null, totalUpcomingCount: 1 },
        balance: { availableCredits: 150, pendingCredits: 60 },
      });

      await new HttpLearnerDashboardGateway().submitReview('bkg-0001', { rating: 4, body: '' });

      const ratingCall = fetchMock.mock.calls.find(
        (c) => String(c[0]).includes('/bkg-0001/rating'),
      ) as unknown as [string, RequestInit] | undefined;
      expect(ratingCall).toBeDefined();
      expect(JSON.parse(String(ratingCall?.[1].body))).toEqual({
        stars: 4,
        comment: '',
      });
    });

    it('surfaces the API message when the rating is refused', async () => {
      stubApi({
        bookings: { items: [bookingItem()], nextCursor: null, totalUpcomingCount: 1 },
        balance: { availableCredits: 0, pendingCredits: 0 },
        postStatus: { '/classes/bookings/bkg-0001/rating': 409 },
      });

      await expect(
        new HttpLearnerDashboardGateway().submitReview('bkg-0001', { rating: 5, body: '' }),
      ).rejects.toThrow();
    });
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
