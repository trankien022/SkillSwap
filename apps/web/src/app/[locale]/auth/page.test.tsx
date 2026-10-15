import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import viMessages from '../../../messages/vi.json';
import AuthPage from './page';

/**
 * Regression: the auth page rendered the full authenticated `Navbar`, so a
 * signed-out visitor was offered "My Bookings", "Teaching", "Wallet & Credits",
 * a credits pill and a notification bell — five routes that answer 401 for
 * them. The page is also where a stale token made the nav render its
 * signed-in shape. It now carries a brand-only header: no nav items at all.
 *
 * The form is stubbed (its behaviour is covered by AuthForm.test.tsx) and the
 * server-only next-intl helpers are stubbed so the async page can be awaited
 * in jsdom.
 */
vi.mock('../../../components/auth/AuthForm', () => ({
  AuthForm: () => <div data-testid="auth-form-stub" />,
}));
// The footer is an async Server Component (it resolves its own locale
// messages), which cannot suspend inside a jsdom render.
vi.mock('../../../components/landing/SiteFooter', () => ({
  SiteFooter: () => <footer data-testid="footer-stub" />,
}));
vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: async () => (key: string) => key,
}));

describe('auth page chrome', () => {
  it('exposes the brand and no signed-in navigation items', async () => {
    const ui = await AuthPage({
      params: Promise.resolve({ locale: 'vi' }),
      searchParams: Promise.resolve({ tab: 'login' }),
    });
    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        {ui}
      </NextIntlClientProvider>,
    );

    // The brand mark stays (same asset as every other header).
    expect(screen.getByAltText('SkillSwap')).toBeDefined();
    expect(screen.getByTestId('auth-form-stub')).toBeDefined();

    // None of the session-only destinations survive on this screen.
    const hrefs = screen.queryAllByRole('link').map((a) => a.getAttribute('href'));
    for (const deadEnd of [
      '/bookings',
      '/instructor',
      '/wallet',
      '/notifications',
      '/classes',
      '/skills',
      '/verification',
      '/verifier',
      '/admin',
    ]) {
      expect(hrefs, `auth page must not link to ${deadEnd}`).not.toContain(deadEnd);
    }

    // No credits pill and no notification bell either.
    expect(screen.queryByTestId('navbar-credits')).toBeNull();
    expect(screen.queryByTitle('Trung tâm Thông báo')).toBeNull();
  });
});
