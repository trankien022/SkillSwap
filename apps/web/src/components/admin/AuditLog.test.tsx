import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import viMessages from '../../messages/vi.json';
import { AuditLog } from './AuditLog';
import { AdminAuthError } from '../../lib/verification/http-gateway';

/**
 * FR-015 / W3: the audit log.
 *
 * The behaviours worth pinning are the ones a passing-but-wrong version would also
 * have. An audit screen can be wrong in ways that are actively misleading: showing
 * a bare date that the contract would reject, presenting "we could not ask" as "no
 * events", or letting a filter that matches nothing look like a working filter. Each
 * of those gets a test.
 */

const listAuditLog = vi.fn();

vi.mock('../../lib/verification/http-gateway', async () => {
  const actual = await vi.importActual<typeof import('../../lib/verification/http-gateway')>(
    '../../lib/verification/http-gateway',
  );
  return {
    ...actual,
    HttpVerificationGateway: class {
      listAuditLog = listAuditLog;
    },
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function page(items: unknown[], nextCursor: string | null = null, total = items.length) {
  return { items, page: { limit: 20, nextCursor, total } };
}

const suspendedEvent = {
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
};

const walletEvent = {
  ...suspendedEvent,
  id: 'a-2',
  action: 'wallet.transaction.completed',
  targetType: 'wallet_transaction',
  targetId: 'txn-3',
  oldState: null,
  newState: { type: 'escrow_release', direction: 'credit', amountCredits: 50000 },
};

function renderLog() {
  return render(
    <NextIntlClientProvider locale="vi" messages={viMessages}>
      <AuditLog />
    </NextIntlClientProvider>,
  );
}

describe('AuditLog', () => {
  beforeEach(() => {
    listAuditLog.mockResolvedValue(page([suspendedEvent, walletEvent], null, 2));
  });

  it('renders each event with its action, target type and target id', async () => {
    renderLog();

    expect(await screen.findByText('Tạm ngưng Verifier')).toBeTruthy();
    expect(screen.getByText('verifier_account')).toBeTruthy();
    expect(screen.getByText('Đối tượng: verifier-9')).toBeTruthy();
  });

  it('shows the old→new state pair, which is the point of the row', async () => {
    renderLog();

    expect(await screen.findByText('Thay đổi: status=active → status=suspended')).toBeTruthy();
  });

  it('does not invent a state change for a row that has no old state', async () => {
    listAuditLog.mockResolvedValue(page([walletEvent], null, 1));
    renderLog();

    await screen.findByText('Hoàn tất giao dịch ví');
    // `oldState` is null here: rendering "— → ..." would imply a transition that never happened.
    expect(screen.queryByText(/Thay đổi:/)).toBeNull();
  });

  it('names the missing actor instead of leaving a blank', async () => {
    renderLog();

    // A blank actor field reads as a rendering bug; a labelled one reads as the documented gap.
    // Every row shares the label on purpose — there is no actor to show — so this is an all-query.
    const labels = await screen.findAllByText('Người thực hiện: chưa ghi nhận');
    expect(labels).toHaveLength(2);
  });

  it('states plainly that the actor filter matches nothing today', async () => {
    renderLog();

    // Without this an administrator concludes the filter is broken. With it, the limit is visible.
    expect(await screen.findByTestId('audit-actor-notice')).toBeTruthy();
  });

  it('renders a readable timestamp, not a raw ISO string', async () => {
    renderLog();

    await screen.findByText('Tạm ngưng Verifier');
    // The raw instant the API sent never reaches the screen.
    expect(screen.queryByText(/2026-10-15T09:30/)).toBeNull();
    // It is rendered through `toLocaleString`, so the value is locale-shaped rather than ISO.
    // Asserted via the row's own text to avoid depending on one ICU date layout.
    const rows = screen.getAllByText(/Thời điểm:/);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].textContent).not.toMatch(/T\d\d:\d\d:\d\d/);
  });

  it('sends the selected action as a filter', async () => {
    renderLog();
    await screen.findByText('Tạm ngưng Verifier');

    fireEvent.change(screen.getByLabelText('Hành động'), {
      target: { value: 'student.verification.approved' },
    });

    await waitFor(() => {
      expect(listAuditLog).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: 'student.verification.approved' }),
      );
    });
  });

  it('defaults to newest first', async () => {
    renderLog();

    await screen.findByText('Tạm ngưng Verifier');
    expect(listAuditLog).toHaveBeenCalledWith(expect.objectContaining({ sort: '-occurredAt' }));
  });

  it('does not offer an action the contract would reject', async () => {
    renderLog();
    await screen.findByText('Tạm ngưng Verifier');

    // Free text here would let an admin type `Approve` and get a 400 they have to decode;
    // the options are the actions the system actually audits.
    const options = Array.from(
      screen.getByLabelText('Hành động').querySelectorAll('option'),
    ).map((option) => option.getAttribute('value'));
    expect(options).toContain('skill.verifier.suspended');
    expect(options).not.toContain('Approve');
  });

  it('sends a date-only `from` as a full datetime, which the contract requires', async () => {
    renderLog();
    await screen.findByText('Tạm ngưng Verifier');

    // A bare `2026-10-15` from the date input is not `z.string().datetime()`; passing it
    // straight through would 400 on every use of the filter.
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-15' } });

    await waitFor(() => {
      expect(listAuditLog).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: '2026-10-15T00:00:00.000Z' }),
      );
    });
  });

  it('widens `to` to the end of the chosen day, so same-day events are included', async () => {
    renderLog();
    await screen.findByText('Tạm ngưng Verifier');

    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: '2026-10-15' } });

    await waitFor(() => {
      // Inclusive: an event at 14:00 on the 15th must not be silently excluded.
      expect(listAuditLog).toHaveBeenLastCalledWith(
        expect.objectContaining({ to: '2026-10-15T23:59:59.999Z' }),
      );
    });
  });

  it('omits a blank actor rather than sending an empty query param', async () => {
    renderLog();

    await screen.findByText('Tạm ngưng Verifier');
    expect(listAuditLog).toHaveBeenCalledWith(expect.objectContaining({ actorId: undefined }));
  });

  it('shows the server total rather than the number of rendered rows', async () => {
    listAuditLog.mockResolvedValue(page([suspendedEvent], 'cursor-1', 132));
    renderLog();

    expect(await screen.findByText('132 sự kiện khớp bộ lọc')).toBeTruthy();
  });

  it('appends the next page and keeps the rows already shown', async () => {
    // Keyed on the cursor rather than a `Once` queue: the first mount can issue the initial
    // read more than once (React's development double-invoke), and a `Once` queue would then
    // hand the second page to the first request and make the assertion meaningless.
    listAuditLog.mockImplementation((query: { cursor?: string }) =>
      Promise.resolve(
        query?.cursor === 'cursor-1' ? page([walletEvent], null, 2) : page([suspendedEvent], 'cursor-1', 2),
      ),
    );

    renderLog();
    // Both pages report a total of 2, so this label is the list's own header.
    await screen.findByText('2 sự kiện khớp bộ lọc');

    fireEvent.click(screen.getByRole('button', { name: 'Tải thêm' }));

    // Asserted on target ids rather than action labels: every action label in the rows is
    // *also* an option in the filter above, so only the target ids are unique to a row.
    // The first page's row stays — paging that replaced the list would lose the admin's place.
    await waitFor(() => {
      expect(screen.getByText('Đối tượng: txn-3')).toBeTruthy();
      expect(screen.getByText('Đối tượng: verifier-9')).toBeTruthy();
    });
    expect(listAuditLog).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-1' }),
    );
  });

  it('offers "load more" only when there is a next page', async () => {
    renderLog();

    await screen.findByText('Tạm ngưng Verifier');
    expect(screen.queryByRole('button', { name: 'Tải thêm' })).toBeNull();
  });

  it('shows an honest empty state when the filters match nothing', async () => {
    listAuditLog.mockResolvedValue(page([], null, 0));
    renderLog();

    expect(await screen.findByText('Không có sự kiện nào khớp bộ lọc.')).toBeTruthy();
  });

  it('surfaces a failure instead of presenting it as an empty log', async () => {
    listAuditLog.mockRejectedValue(new Error('audit store unreachable'));
    renderLog();

    // "nothing happened" and "we could not read the log" must never look the same here.
    expect(await screen.findByText(/Không thể tải nhật ký kiểm định/)).toBeTruthy();
    expect(screen.getByText('audit store unreachable')).toBeTruthy();
    expect(screen.queryByText('Không có sự kiện nào khớp bộ lọc.')).toBeNull();
  });

  it('shows the unauthorized state on a 403, with no pointless retry', async () => {
    listAuditLog.mockRejectedValue(new AdminAuthError());
    renderLog();

    expect(await screen.findByText('Bạn không có quyền truy cập nhật ký kiểm định')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });

  it('offers no edit or delete control, because the log is append-only', async () => {
    renderLog();
    await screen.findByText('Tạm ngưng Verifier');

    // NFR-005: a row that can be changed afterwards accounts for nothing.
    expect(screen.queryByRole('button', { name: /Sửa|Xoá|Chỉnh/ })).toBeNull();
  });
});
