import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import viMessages from '../../messages/vi.json';
import { AdminDashboard } from './AdminDashboard';
import { AdminAuthError } from '../../lib/verification/http-gateway';

/**
 * FR-015 / W4: the operations dashboard.
 *
 * The failure this suite exists to prevent is the one a dashboard is uniquely good
 * at hiding: reporting **zeroes** when the read actually threw. "0 awaiting review"
 * and "we could not ask" look identical in digits and are opposite instructions to
 * an operator, so the failure path is tested as carefully as the happy one.
 *
 * The second thing pinned is that each count is a link to the queue that owns it. A
 * number an operator cannot act on is trivia, and a number that links somewhere
 * *different* from where it is counted is worse than that.
 */

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const dashboard = {
  verifications: { pending: 7, approved: 5, rejected: 1, revoked: 2 },
  evidence: { pending: 3, claimed: 4, approved: 9, rejected: 1, superseded: 1 },
  evidenceByDomain: { Programming: 5, Languages: 2 },
  recentAuditEvents: [
    {
      id: 'a-1',
      actorId: null,
      action: 'skill.verifier.suspended',
      targetType: 'verifier_account',
      targetId: 'verifier-9',
      oldState: { status: 'active' },
      newState: { status: 'suspended' },
      occurredAt: '2026-10-15T09:30:00.000Z',
      traceId: null,
      metadata: null,
      sourceEventId: 'evt-1',
    },
  ],
  generatedAt: '2026-10-16T00:00:00.000Z',
};

function renderDashboard() {
  return render(
    <NextIntlClientProvider locale="vi" messages={viMessages}>
      <AdminDashboard />
    </NextIntlClientProvider>,
  );
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    getAdminDashboard.mockReset();
    getAdminDashboard.mockResolvedValue(dashboard);
  });

  it('shows the pending-verification count', async () => {
    renderDashboard();

    const card = (await screen.findByText('Xác minh sinh viên chờ duyệt')).closest('a');
    expect(card?.textContent).toContain('7');
  });

  it('links each metric to the queue that owns it', async () => {
    renderDashboard();

    // The count is only useful if it opens the work it counts.
    const pending = (await screen.findByText('Xác minh sinh viên chờ duyệt')).closest('a');
    expect(pending?.getAttribute('href')).toBe('/vi/admin/student-verifications?status=pending');

    const evidence = screen.getByText('Bằng chứng đang trong hàng đợi').closest('a');
    expect(evidence?.getAttribute('href')).toBe('/vi/admin/verifiers');
  });

  it('keeps unclaimed and in-review distinct rather than merging them', async () => {
    renderDashboard();

    // `pending + claimed` is the live-queue total, but the two states mean opposite
    // things to an operator: nobody has taken it vs someone is stuck on it.
    const evidence = (await screen.findByText('Bằng chứng đang trong hàng đợi')).closest('a');
    expect(evidence?.textContent).toContain('7'); // 3 pending + 4 claimed
    expect(evidence?.textContent).toContain('3 chưa có Verifier nhận, 4 đang thẩm định');
  });

  it('lists backlog by domain with the live-queue count', async () => {
    renderDashboard();

    expect(await screen.findByText('Programming')).toBeTruthy();
    expect(screen.getByText('Languages')).toBeTruthy();
    expect(screen.getByText('5 việc')).toBeTruthy();
    expect(screen.getByText('2 việc')).toBeTruthy();
  });

  it('links each domain to the verifier queue filtered to it', async () => {
    renderDashboard();

    const link = (await screen.findByText('Programming')).closest('a');
    expect(link?.getAttribute('href')).toBe('/vi/admin/verifiers?domain=Programming');
  });

  it('orders domains by backlog, so the worst is first', async () => {
    renderDashboard();

    await screen.findByText('Programming');
    const names = screen
      .getAllByRole('link')
      .map((a) => a.textContent)
      .filter((text) => text === 'Programming' || text === 'Languages');
    // A backlog list whose biggest number is buried is not a triage aid.
    expect(names[0]).toBe('Programming');
  });

  it('says so plainly when no domain has live work', async () => {
    getAdminDashboard.mockResolvedValue({ ...dashboard, evidenceByDomain: {} });
    renderDashboard();

    // An empty map means "nothing waiting anywhere" — it must not render as a blank panel.
    expect(await screen.findByTestId('admin-dashboard-no-domains')).toBeTruthy();
  });

  it('shows the recent audited actions, localised', async () => {
    renderDashboard();

    expect(await screen.findByText('Tạm ngưng Verifier')).toBeTruthy();
  });

  it('offers a way to the full log from the recent list', async () => {
    renderDashboard();

    const viewAll = (await screen.findByText('Xem toàn bộ nhật ký')).closest('a');
    expect(viewAll?.getAttribute('href')).toBe('/vi/admin/audit-log');
  });

  it('shows an empty state for the recent list rather than a blank panel', async () => {
    getAdminDashboard.mockResolvedValue({ ...dashboard, recentAuditEvents: [] });
    renderDashboard();

    expect(await screen.findByTestId('admin-dashboard-no-audit')).toBeTruthy();
  });

  it('shows when the figures were assembled', async () => {
    renderDashboard();

    // Counts read live and a cached aggregate look identical on screen; the operator
    // deciding whether to act deserves to know which this is.
    expect(await screen.findByText(/Số liệu tổng hợp lúc/)).toBeTruthy();
  });

  it('shows a failure as a failure, never as zeroes', async () => {
    getAdminDashboard.mockRejectedValue(new Error('aggregate read failed'));
    renderDashboard();

    // The dangerous bug: rendering "0 awaiting review" because the request threw.
    expect(await screen.findByTestId('admin-dashboard-failed')).toBeTruthy();
    expect(screen.getByText('aggregate read failed')).toBeTruthy();
    expect(screen.queryByText('Xác minh sinh viên chờ duyệt')).toBeNull();
  });

  it('retries the same read when asked', async () => {
    getAdminDashboard
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(dashboard);

    renderDashboard();
    await screen.findByTestId('admin-dashboard-failed');

    screen.getByRole('button', { name: 'Thử lại' }).click();

    expect(await screen.findByTestId('admin-dashboard')).toBeTruthy();
  });

  it('shows the unauthorized state on a 403, with no pointless retry', async () => {
    getAdminDashboard.mockRejectedValue(new AdminAuthError());
    renderDashboard();

    expect(await screen.findByText('Bạn không có quyền truy cập bảng điều khiển')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });
});
