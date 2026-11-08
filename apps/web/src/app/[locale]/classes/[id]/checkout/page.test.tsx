import { Suspense } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { envelopeOk } from '@skillswap/contracts';
import en from '../../../../../messages/en.json';
import BookingCheckoutPage from './page';

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/classes/cls-1/checkout',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('BookingCheckoutPage (W11)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the class title — not the class description paragraph — in the checkout heading', async () => {
    const startsAt = new Date(Date.now() + 72 * 3_600_000).toISOString();
    const longDescription =
      'Long multi-sentence syllabus description that explains every exercise in detail and must never be used as the checkout h2 heading.';

    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url.includes('/wallet/balance')) {
          return Promise.resolve(
            jsonResponse(
              envelopeOk({
                ownerId: 'usr-1',
                availableCredits: 250,
                escrowCredits: 0,
                updatedAt: startsAt,
              }),
            ),
          );
        }
        if (url.includes('/classes/cls-1')) {
          return Promise.resolve(
            jsonResponse(
              envelopeOk({
                id: 'cls-1',
                teacherId: 'tch-1',
                skillId: 'skl-1',
                title: 'IELTS Speaking Part 2 Intensive',
                description: longDescription,
                startsAt,
                durationMinutes: 60,
                priceCredits: 120,
                capacity: 4,
                state: 'published',
                confirmedBookingsCount: 1,
                availableSeats: 3,
                format: 'group',
                level: 'intermediate',
                teacher: {
                  id: 'tch-1',
                  fullName: 'Minh Tran',
                  avatarUrl: null,
                  bio: null,
                  isStudentVerified: true,
                  schoolName: 'Bach Khoa',
                },
                skill: {
                  id: 'skl-1',
                  name: 'IELTS Speaking',
                  slug: 'ielts-speaking',
                  category: 'Languages',
                },
                ratingAvg: 4.8,
                ratingCount: 5,
                reviews: [],
                ownBooking: null,
              }),
            ),
          );
        }
        if (url.includes('/auth/me')) {
          return Promise.resolve(jsonResponse({ ok: false }, 401));
        }
        return Promise.resolve(jsonResponse(envelopeOk({})));
      }),
    );

    const params = Promise.resolve({ locale: 'en', id: 'cls-1' });
    await act(async () => {
      render(
        <NextIntlClientProvider locale="en" messages={en}>
          <Suspense fallback={<div>Loading...</div>}>
            <BookingCheckoutPage params={params} />
          </Suspense>
        </NextIntlClientProvider>,
      );
    });

    const heading = await waitFor(() =>
      screen.getByRole('heading', { level: 2, name: 'IELTS Speaking Part 2 Intensive' }),
    );
    expect(heading).toBeDefined();
    expect(screen.queryByRole('heading', { level: 2, name: longDescription })).toBeNull();
  });
});
