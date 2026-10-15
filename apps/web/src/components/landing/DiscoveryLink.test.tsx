import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
const getTokens = vi.fn();
vi.mock('../../lib/api-client', () => ({ getTokens: () => getTokens() }));
vi.mock('../../i18n/routing', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
const { DiscoveryLink } = await import('./DiscoveryLink');
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe('homepage class discovery', () => {
  it('preserves the selected subject and locale through guest sign-in', () => {
    getTokens.mockReturnValue(null);
    render(
      <DiscoveryLink locale="vi" category="design" className="">
        Design
      </DiscoveryLink>,
    );
    const href = screen.getByRole('link').getAttribute('href')!;
    const url = new URL(href, 'http://localhost');
    expect(url.pathname).toBe('/auth');
    expect(url.searchParams.get('returnUrl')).toBe('/vi/classes?category=design');
  });
  it('takes a signed-in student straight to the selected subject', () => {
    getTokens.mockReturnValue({ accessToken: 'test-token' });
    render(
      <DiscoveryLink locale="en" category="programming" className="">
        Code
      </DiscoveryLink>,
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/classes?category=programming');
  });
});
