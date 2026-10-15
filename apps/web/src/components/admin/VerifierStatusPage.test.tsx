import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import viMessages from '../../messages/vi.json';
import { VerifierStatusPage } from './VerifierStatusPage';

/**
 * `VerifierStatusPage` gates an admin-only deep link. Before this test existed
 * the signed-out CTA was `href="#sign-in"` — an anchor that does not exist
 * anywhere in the app, so the primary action was a silent no-op.
 */
vi.mock('../../lib/api-client', () => ({
  getMe: vi.fn(async () => null),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage(accountId = 'acc-123') {
  return render(
    <NextIntlClientProvider locale="vi" messages={viMessages}>
      <VerifierStatusPage accountId={accountId} />
    </NextIntlClientProvider>,
  );
}

describe('VerifierStatusPage signed-out CTA', () => {
  it('links to the real sign-in route instead of a dead #sign-in anchor', async () => {
    renderPage('acc-abc');

    const signIn = await screen.findByRole('link', { name: 'Đăng nhập ngay' });

    // Real, navigable destination with the locale and the deep link preserved.
    expect(signIn.getAttribute('href')).not.toBe('#sign-in');
    expect(signIn.getAttribute('href')).toContain('/vi/auth?tab=login');
    expect(signIn.getAttribute('href')).toContain(
      encodeURIComponent('/vi/admin/verifiers/acc-abc'),
    );
  });
});
