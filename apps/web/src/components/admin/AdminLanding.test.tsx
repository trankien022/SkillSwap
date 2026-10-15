import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import viMessages from '../../messages/vi.json';
import { getMe } from '../../lib/api-client';
import { AdminLanding } from './AdminLanding';

/**
 * The admin home must prove four things:
 *   1. an admin actually reaches it and every link on it is a route that
 *      exists (no fabricated queue/list navigation),
 *   2. the operations dashboard renders on it, so the landing is a real home
 *      rather than a menu of deep links,
 *   3. a learner gets the translated forbidden banner instead of admin tools,
 *   4. an anonymous visitor gets a real sign-in link (no dead anchors).
 *
 * The dashboard is stubbed here: this suite is about the landing's composition and
 * role gate, and the dashboard's own behaviour is pinned in `AdminDashboard.test.tsx`.
 */
const dashboard = {
  verifications: { pending: 2, approved: 5, rejected: 1, revoked: 0 },
  evidence: { pending: 1, claimed: 2, approved: 9, rejected: 1, superseded: 1 },
  evidenceByDomain: { Programming: 3 },
  recentAuditEvents: [],
  generatedAt: '2026-10-16T00:00:00.000Z',
};

const getAdminDashboard = vi.fn();

vi.mock('../../lib/verification/http-gateway', async () => {
  const actual = await vi.importActual<typeof import('../../lib/verification/http-gateway')>(
    '../../lib/verification/http-gateway',
  );
  return {
    ...actual,
    HttpVerificationGateway: class {
      getAdminDashboard = getAdminDashboard;
    },
  };
});

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
  getAdminDashboard.mockReset();
  getAdminDashboard.mockResolvedValue(dashboard);
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
    // The dashboard is admin-only too: a learner must not even trigger its read.
    expect(getAdminDashboard).not.toHaveBeenCalled();
  });

  it('renders links only to admin routes that exist, for an admin', async () => {
    vi.mocked(getMe).mockResolvedValue({
      id: 'acc-admin',
      email: 'admin@example.com',
      displayName: 'Admin',
      role: 'admin',
    });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Trang quản trị' })).toBeDefined();

    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    // The three operations surfaces, plus the per-domain links the dashboard renders.
    expect(hrefs).toContain('/vi/admin/student-verifications');
    expect(hrefs).toContain('/vi/admin/verifiers');
    expect(hrefs).toContain('/vi/admin/audit-log');
    // Every link goes to a route under this app's admin tree — no fabricated navigation,
    // and nothing pointing at a page that does not exist.
    for (const href of hrefs) {
      expect(href).toMatch(/^\/vi\/admin(\/|$|\?)/);
    }
  });

  it('no longer claims the operations screens are missing', async () => {
    vi.mocked(getMe).mockResolvedValue({
      id: 'acc-admin',
      email: 'admin@example.com',
      displayName: 'Admin',
      role: 'admin',
    });

    renderPage();
    await screen.findByRole('heading', { name: 'Trang quản trị' });

    // The old banner was a lie once the screens shipped; a landing that denies its own
    // links is worse than no banner at all.
    expect(screen.queryByText('Chưa có sẵn')).toBeNull();
    expect(screen.queryByText(/chưa tồn tại trên hệ thống/)).toBeNull();
  });

  it('composes the dashboard into the landing', async () => {
    vi.mocked(getMe).mockResolvedValue({
      id: 'acc-admin',
      email: 'admin@example.com',
      displayName: 'Admin',
      role: 'admin',
    });

    renderPage();

    expect(await screen.findByTestId('admin-dashboard')).toBeTruthy();
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
