import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { envelopeOk, type MeResponse, type WalletBalanceView } from '@skillswap/contracts';
import enMessages from '../messages/en.json';
import viMessages from '../messages/vi.json';
import { Navbar } from './navbar';

const mockMe = (overrides: Partial<MeResponse> = {}): MeResponse => ({
  id: 'acc-1',
  email: 'test@example.com',
  displayName: 'User',
  role: 'user',
  status: 'active',
  studentVerification: null,
  ...overrides,
});

const mockBalance = (overrides: Partial<WalletBalanceView> = {}): WalletBalanceView => ({
  availableCredits: 0,
  pendingCredits: 0,
  ...overrides,
});

beforeEach(() => {
  // Mock fetch to return valid envelope contracts to avoid unhandled network errors in jsdom
  vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(envelopeOk(mockBalance())), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

/**
 * The navbar resolves its locale through next-intl, the same way the server
 * does. Every test renders inside the provider for the locale under test, so a
 * regression to any window/serving-time-sensitive locale source fails here
 * instead of only in the browser as a hydration mismatch.
 */
function renderNavbar(
  props: Parameters<typeof Navbar>[0] = {},
  locale: 'en' | 'vi' = 'vi',
) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'en' ? enMessages : viMessages}
    >
      <Navbar {...props} />
    </NextIntlClientProvider>,
  );
}

describe('Navbar component', () => {
  it('truncates long usernames with title attribute for tooltip and max-width boundaries', () => {
    const longName = 'nguyenchaunhatanh1008';
    renderNavbar({
      me: mockMe({
        id: 'acc-1',
        email: `${longName}@gmail.com`,
        displayName: longName,
      }),
    });

    const nameEl = screen.getByTitle(longName);
    expect(nameEl).toBeDefined();
    expect(nameEl.textContent).toBe(longName);
    expect(nameEl.className).toContain('truncate');
    expect(nameEl.parentElement?.className).toContain('min-w-0');
    expect(nameEl.parentElement?.className).toContain('max-w-');
  });

  it('renders verified student badge when verified', () => {
    renderNavbar({
      me: mockMe({
        id: 'acc-2',
        email: 'test@fpt.edu.vn',
        displayName: 'Minh Tu',
        studentVerification: { status: 'approved', reason: null },
      }),
    });

    const verifiedEl = screen.getByText('SV đã xác minh');
    expect(verifiedEl).toBeDefined();
    expect(verifiedEl.className).toContain('truncate');
  });

  it('renders learner role badge when unverified', () => {
    renderNavbar({
      me: mockMe({
        id: 'acc-3',
        email: 'test@gmail.com',
        displayName: 'Anh Khoa',
        studentVerification: { status: 'pending', reason: null },
      }),
    });

    const learnerEl = screen.getByText('Học viên');
    expect(learnerEl).toBeDefined();
    expect(learnerEl.className).toContain('truncate');
  });

  it('renders credit balance badge', () => {
    renderNavbar({ balance: mockBalance({ availableCredits: 250 }) });

    expect(screen.getByText('250 Credits')).toBeDefined();
  });

  it('renders sign in button when guest', () => {
    renderNavbar();

    const signInLink = screen.getByRole('link', { name: 'Đăng nhập' });
    expect(signInLink).toBeDefined();
  });

  it('renders navigation link with title tooltip for verification', () => {
    renderNavbar();

    const verificationLink = screen.getByTitle('Trung tâm Thẩm định & Xác minh');
    expect(verificationLink).toBeDefined();
    expect(verificationLink.textContent).toBe('Xác minh');
  });

  it('builds every nav href and label from the resolved locale, not the URL', () => {
    // Regression: the navbar used to derive the locale from
    // `window.location.pathname`, which is undefined during SSR and on the
    // server therefore always produced the 'vi' fallback. On /en the server
    // emitted /vi hrefs and Vietnamese labels while the client emitted /en and
    // English ones, and React reported a hydration mismatch on every page.
    const { unmount } = renderNavbar({}, 'en');

    expect(screen.getByRole('link', { name: /Explore/ }).getAttribute('href')).toBe('/en/classes');
    expect(screen.getByRole('link', { name: /My Bookings/ }).getAttribute('href')).toBe('/en/bookings');
    expect(screen.getByRole('link', { name: /Skills/ }).getAttribute('href')).toBe('/en/skills');
    expect(screen.queryByRole('link', { name: /Khám phá/ })).toBeNull();
    unmount();

    cleanup();

    renderNavbar({}, 'vi');

    expect(screen.getByRole('link', { name: /Khám phá/ }).getAttribute('href')).toBe('/vi/classes');
    expect(screen.getByRole('link', { name: /Kỹ năng/ }).getAttribute('href')).toBe('/vi/skills');
    expect(screen.queryByRole('link', { name: /Explore/ })).toBeNull();
  });
});
