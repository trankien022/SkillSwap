import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import viMessages from '../../messages/vi.json';
import { authenticate } from '../../lib/api-client';
import { AuthForm } from './AuthForm';

/**
 * Regression for the reported bug: after signing in, *every* role was
 * redirected to `/classes`. An admin therefore landed on the marketplace with
 * no admin nav anywhere, and a verifier with no queue. The redirect is
 * asserted end-to-end here (role comes back from `authenticate`), while the
 * full role/returnUrl matrix lives in `lib/post-login-path.test.ts`.
 */
const { push, refresh, search } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  search: { tab: null as string | null, returnUrl: null as string | null },
}));

vi.mock('../../lib/api-client', () => ({ authenticate: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'tab' ? search.tab : search.returnUrl),
  }),
}));

const TOKENS = { accessToken: 'access-token', refreshToken: 'refresh-token' };

function renderForm() {
  return render(
    <NextIntlClientProvider locale="vi" messages={viMessages}>
      <AuthForm initialTab="login" locale="vi" />
    </NextIntlClientProvider>,
  );
}

function submitLogin() {
  const email = document.querySelector('input[type="email"]') as HTMLInputElement;
  const password = document.querySelector('input[type="password"]') as HTMLInputElement;
  fireEvent.change(email, { target: { value: 'someone@demo.skillswap.local' } });
  fireEvent.change(password, { target: { value: 'Demo1234!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập vào SkillSwap' }));
}

/** The form redirects one second after showing its success notice. */
async function flushLoginAndAdvanceRedirect() {
  await act(async () => {
    // Let the authenticate promise and the success state settle.
    await Promise.resolve();
  });
  expect(authenticate).toHaveBeenCalledTimes(1);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(authenticate).mockReset();
  push.mockReset();
  refresh.mockReset();
  search.tab = 'login';
  search.returnUrl = null;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('AuthForm role landing', () => {
  it('sends an admin to /vi/admin, not to the marketplace', async () => {
    vi.mocked(authenticate).mockResolvedValue({ tokens: TOKENS, role: 'admin' });

    renderForm();
    submitLogin();
    await flushLoginAndAdvanceRedirect();

    expect(push).toHaveBeenCalledWith('/vi/admin');
    expect(push).not.toHaveBeenCalledWith('/vi/classes');
  });

  it('sends a verifier to their queue', async () => {
    vi.mocked(authenticate).mockResolvedValue({ tokens: TOKENS, role: 'verifier' });

    renderForm();
    submitLogin();
    await flushLoginAndAdvanceRedirect();

    expect(push).toHaveBeenCalledWith('/vi/verifier');
  });

  it('sends a learner to the marketplace', async () => {
    vi.mocked(authenticate).mockResolvedValue({ tokens: TOKENS, role: 'user' });

    renderForm();
    submitLogin();
    await flushLoginAndAdvanceRedirect();

    expect(push).toHaveBeenCalledWith('/vi/classes');
  });

  it('lets an explicit returnUrl win over the role default', async () => {
    vi.mocked(authenticate).mockResolvedValue({ tokens: TOKENS, role: 'admin' });
    search.returnUrl = '/vi/admin/student-verifications';

    renderForm();
    submitLogin();
    await flushLoginAndAdvanceRedirect();

    expect(push).toHaveBeenCalledWith('/vi/admin/student-verifications');
  });
});
