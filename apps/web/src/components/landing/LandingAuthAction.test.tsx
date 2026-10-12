import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../messages/en.json';

// The action reads the session token; the test controls whether one exists.
const getTokens = vi.fn();
vi.mock('../../lib/api-client', () => ({
  getTokens: () => getTokens(),
}));

// next-intl's Link reaches for next/navigation, which the test environment
// cannot resolve. Render a plain anchor that keeps the href observable.
vi.mock('../../i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Import after the mocks are registered.
const { LandingAuthAction } = await import('./LandingAuthAction');

const EXPLORE = '/en/classes';

function renderAction() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LandingAuthAction exploreHref={EXPLORE} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('LandingAuthAction', () => {
  it('sends a guest to sign-in with a returnUrl instead of the auth-only marketplace', () => {
    // Regression: the landing linked straight to /classes for everyone.
    // GET /classes requires auth, so a guest landed on the unauth state.
    getTokens.mockReturnValue(null);
    renderAction();

    const explore = screen.getByRole('link', { name: /Explore/ });
    const href = explore.getAttribute('href') ?? '';

    expect(href).toContain('/auth');
    expect(href).toContain('tab=login');
    // The intent survives sign-in: the marketplace is where they were headed.
    expect(href).toContain(encodeURIComponent(EXPLORE));
    expect(href).not.toBe(EXPLORE);
  });

  it('keeps the direct marketplace link for a signed-in visitor', () => {
    getTokens.mockReturnValue({ accessToken: 'token' });
    renderAction();

    expect(screen.getByRole('link', { name: /Explore/ }).getAttribute('href')).toBe(EXPLORE);
  });

  it('offers a sign-in pill only while signed out', () => {
    getTokens.mockReturnValue(null);
    const { unmount } = renderAction();
    expect(screen.getByRole('link', { name: /Sign in/ })).toBeDefined();
    unmount();
    cleanup();

    getTokens.mockReturnValue({ accessToken: 'token' });
    renderAction();
    expect(screen.queryByRole('link', { name: /Sign in/ })).toBeNull();
  });
});
