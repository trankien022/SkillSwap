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
// cannot resolve. This mock records the href it was *given* — i.e. before
// next-intl applies its own locale prefix. The real Link adds the prefix, so a
// caller that passes a prefixed path produces /en/en/classes in the browser.
// That is why this suite asserts the prop is locale-LESS, not the final URL.
const linkHrefs: string[] = [];
vi.mock('../../i18n/routing', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => {
    linkHrefs.push(href);
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));

// Import after the mocks are registered.
const { LandingAuthAction } = await import('./LandingAuthAction');

/** Locale-less by contract: Link adds the /en prefix itself. */
const EXPLORE = '/classes';
/** What the user must actually land on. */
const EXPLORE_ABSOLUTE = '/en/classes';

function renderAction() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <LandingAuthAction exploreHref={EXPLORE} locale="en" />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  linkHrefs.length = 0;
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
    // The intent survives sign-in, as an ABSOLUTE path: returnUrl is not passed
    // through Link, so it must carry the locale itself.
    expect(href).toContain(encodeURIComponent(EXPLORE_ABSOLUTE));
    expect(href).not.toContain(encodeURIComponent(`/${EXPLORE}`));
  });

  it('passes a locale-less path to Link for a signed-in visitor', () => {
    // Regression: SiteHeader passed `/${locale}/classes`. next-intl's Link then
    // prefixed the locale again, producing /en/en/classes.
    getTokens.mockReturnValue({ accessToken: 'token' });
    renderAction();

    const href = screen.getByRole('link', { name: /Explore/ }).getAttribute('href');
    expect(href).toBe(EXPLORE);
    expect(href?.startsWith('/en/')).toBe(false);
  });

  it('never gives Link a locale-prefixed destination', () => {
    // Guards the whole component, both session states.
    for (const tokens of [null, { accessToken: 'token' }]) {
      getTokens.mockReturnValue(tokens);
      const { unmount } = renderAction();
      for (const href of linkHrefs) {
        expect(href.startsWith('/en/')).toBe(false);
        expect(href.startsWith('/vi/')).toBe(false);
      }
      unmount();
      cleanup();
      linkHrefs.length = 0;
    }
  });

  it('keeps the sign-in pill visible at every width for a guest', () => {
    // Regression: the pill was `hidden ... sm:inline-flex`, so phones (<640px)
    // had no visible sign-in affordance at all.
    getTokens.mockReturnValue(null);
    renderAction();

    const pill = screen.getByRole('link', { name: /Sign in/ });
    const className = pill.className;

    expect(className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(className).toContain('inline-flex');
  });

  it('replaces the sign-in pill with a real post-auth destination once signed in', () => {
    // The header must not become a dead end when the sign-in link disappears.
    // /my-bookings is the real post-auth hub; /dashboard does not exist.
    getTokens.mockReturnValue({ accessToken: 'token' });
    renderAction();

    expect(screen.queryByRole('link', { name: /Sign in/ })).toBeNull();
    const hub = screen.getByRole('link', { name: /My bookings/ });
    expect(hub.getAttribute('href')).toBe('/my-bookings');
  });
});
