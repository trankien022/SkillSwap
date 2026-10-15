import { NextIntlClientProvider } from 'next-intl';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { envelopeOk } from '@skillswap/contracts';
import en from '../../messages/en.json';
import { DashboardShell } from './DashboardShell';

/**
 * Behavioural tests for the dashboard shell (FR-021).
 *
 * The shell reads two authenticated endpoints after mount, so these tests stub
 * `fetch` and assert what a learner actually sees: live bookings instead of
 * fixtures, a truthful sign-in state when unauthorized, and an error surface
 * (never fabricated rows) when the backend is unreachable.
 */

const FUTURE = new Date(Date.now() + 48 * 3_600_000).toISOString();

function bookingItem(overrides: Record<string, unknown> = {}) {
  return {
    bookingId: 'bkg-0001',
    classId: 'cls-0001',
    state: 'confirmed',
    priceCredits: 60,
    createdAt: new Date().toISOString(),
    expiresAt: null,
    classSummary: {
      description: 'IELTS speaking deep-dive',
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

function renderShell() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <DashboardShell initial={null} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('DashboardShell (FR-021)', () => {
  it('renders live bookings and metrics read from the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes('/classes/bookings/me')
            ? jsonResponse(
                envelopeOk({
                  items: [bookingItem()],
                  nextCursor: null,
                  totalUpcomingCount: 1,
                }),
              )
            : jsonResponse(envelopeOk({ availableCredits: 150, pendingCredits: 60 })),
        ),
      ),
    );

    renderShell();

    expect(await screen.findByText('IELTS speaking deep-dive')).toBeTruthy();
    // Held escrow comes from the wallet's pending credits, not a fixture: the
    // escrow tile renders the server value (60) next to its unit.
    expect(await screen.findByText(en.Dashboard.metrics.escrow)).toBeTruthy();
    expect(screen.getAllByText('60').length).toBeGreaterThan(0);
  });

  it('shows a sign-in prompt instead of demo data when the session is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes('/classes/bookings/me')
            ? jsonResponse(
                { success: false, code: 'Unauthorized', message: 'nope', data: null, errors: [] },
                401,
              )
            : jsonResponse(envelopeOk({ availableCredits: 0, pendingCredits: 0 })),
        ),
      ),
    );

    renderShell();

    expect(await screen.findByText(en.Workspace.copy.signInToSeeYourClasses)).toBeTruthy();
    expect(screen.queryByText('IELTS speaking deep-dive')).toBeNull();
  });

  it('surfaces an error state rather than fabricated bookings on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('network down'))),
    );

    renderShell();

    expect(await screen.findByText(en.Workspace.copy.couldNotLoadYourClasses)).toBeTruthy();
  });
});
