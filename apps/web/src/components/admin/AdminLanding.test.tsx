import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import viMessages from '../../messages/vi.json';
import { getMe } from '../../lib/api-client';
import { AdminLanding } from './AdminLanding';

/**
 * The admin home must prove three things the reported bug could not:
 *   1. an admin actually reaches it and every link on it is a route that
 *      exists (no fabricated queue/list navigation),
 *   2. a learner gets the translated forbidden banner instead of admin tools,
 *   3. an anonymous visitor gets a real sign-in link (no dead anchors).
 */
const { push, returnUrl } = vi.hoisted(() => ({
  push: vi.fn(),
  returnUrl: { value: null as string | null },
}));

vi.mock('../../lib/api-client', () => ({
  getMe: vi.fn(async () => null),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => ({ get: () => returnUrl.value }),
}));

function renderPage() {
  return render(
    <NextIntlClientProvider locale="vi" messages={viMessages}>
      <AdminLanding />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(getMe).mockReset();
  vi.mocked(getMe).mockResolvedValue(null);
  push.mockReset();
  returnUrl.value = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AdminLanding role gate', () => {
  it('prompts an anonymous visitor to sign in with the deep link preserved', async () => {
    renderPage();

    const signIn = await screen.findByRole('link', { name: 'Đăng nhập ngay' });
    expect(signIn.getAttribute('href')).toContain('/vi/auth?tab=login');
    expect(signIn.getAttribute('href')).toContain(encodeURIComponent('/vi/admin'));
  });

  it('shows the forbidden banner to a signed-in learner', async () => {
    vi.mocked(getMe).mockResolvedValue({
      email: 'learner@example.com',
      displayName: 'Learner',
      role: 'user',
    });

    renderPage();

    expect(
      await screen.findByText('Bạn không có quyền truy cập trang này'),
    ).toBeDefined();
    expect(screen.queryByRole('link', { name: /Duyệt xác minh sinh viên/ })).toBeNull();
  });

  it('renders only links to admin routes that exist for an admin', async () => {
    vi.mocked(getMe).mockResolvedValue({
      id: 'acc-admin',
      email: 'admin@example.com',
      displayName: 'Admin',
      role: 'admin',
    });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Trang quản trị' })).toBeDefined();

    // Exactly one anchor on the page, and it is a real route (the verifier
    // status screen is reached by the form below, never by a fabricated link).
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/vi/admin/student-verifications']);

    // The pending queue / verifier list / audit log are announced as absent.
    expect(screen.getByText('Chưa có sẵn')).toBeDefined();
  });
});

describe('AdminLanding verifier-status control', () => {
  beforeEach(() => {
    vi.mocked(getMe).mockResolvedValue({
      id: 'acc-admin',
      email: 'admin@example.com',
      displayName: 'Admin',
      role: 'admin',
    });
  });

  it('requires an account id instead of navigating to an empty id', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Trang quản trị' });

    fireEvent.click(screen.getByRole('button', { name: 'Mở' }));

    expect(screen.getByRole('alert').textContent).toBe('Vui lòng nhập Account ID.');
    expect(push).not.toHaveBeenCalled();
  });

  it('opens the real verifier status route for a typed account id', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Trang quản trị' });

    fireEvent.change(screen.getByPlaceholderText('Nhập Account ID'), {
      target: { value: 'acc-9' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mở' }));

    expect(push).toHaveBeenCalledWith('/vi/admin/verifiers/acc-9');
  });
});
