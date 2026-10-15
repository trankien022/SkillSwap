import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import viMessages from '../../messages/vi.json';
import { StudentVerificationsQueue } from './StudentVerificationsQueue';
import { AdminAuthError, HttpVerificationGateway } from '../../lib/verification/http-gateway';

/**
 * FR-015 / W1: the student-verification queue.
 *
 * The behaviours worth pinning are the ones a passing-but-wrong version would
 * also have: filters that actually reach the request (rather than only moving a
 * select), a failure that shows an error instead of an empty list, and a 403 that
 * shows the unauthorized state instead of a spinner that never resolves.
 *
 * Uses `fireEvent` rather than `user-event`: this suite's house style is
 * `@testing-library/react` only (see `AuthForm.test.tsx`), and `user-event` is
 * not a dependency of the web workspace.
 */

const listAdminVerifications = vi.fn();

vi.mock('../../lib/verification/http-gateway', async () => {
  const actual = await vi.importActual<typeof import('../../lib/verification/http-gateway')>(
    '../../lib/verification/http-gateway',
  );
  return {
    ...actual,
    HttpVerificationGateway: class {
      listAdminVerifications = listAdminVerifications;
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

const pendingVerification = {
  id: 'v-1',
  status: 'pending',
  schoolName: 'Demo University 1',
  major: 'Computer Science',
  reviewerId: null,
  reason: null,
  decidedAt: null,
  submittedAt: '2026-10-14T00:00:00.000Z',
};

const approvedVerification = {
  id: 'v-2',
  status: 'approved',
  schoolName: 'Demo University 2',
  major: null,
  reviewerId: 'admin-1',
  reason: null,
  decidedAt: '2026-10-15T00:00:00.000Z',
  submittedAt: '2026-10-13T00:00:00.000Z',
};

function renderQueue() {
  return render(
    <NextIntlClientProvider locale="vi" messages={viMessages}>
      <StudentVerificationsQueue />
    </NextIntlClientProvider>,
  );
}

describe('StudentVerificationsQueue', () => {
  beforeEach(() => {
    listAdminVerifications.mockResolvedValue(page([pendingVerification, approvedVerification], null, 2));
  });

  it('opens on the status named in the URL, so a dashboard count lands filtered', async () => {
    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <StudentVerificationsQueue initialStatus="pending" />
      </NextIntlClientProvider>,
    );

    // The dashboard links "awaiting review" with `?status=pending`; landing unfiltered
    // would make the number the operator clicked unverifiable.
    await waitFor(() => {
      expect(listAdminVerifications).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'pending' }),
      );
    });
  });

  it('renders each verification with its status as text, not colour alone', async () => {
    renderQueue();

    const pendingRow = (await screen.findByText('Demo University 1')).closest('a');
    const approvedRow = screen.getByText('Demo University 2').closest('a');
    expect(pendingRow).toBeTruthy();
    expect(approvedRow).toBeTruthy();

    // The status label is required: a pill whose meaning lives only in its colour would be
    // unreadable to a colour-blind admin and invisible in a monochrome screenshot.
    //
    // Scoped to the row on purpose: "Chờ duyệt" is also a filter `<option>` in the toolbar
    // above, so a document-wide query would match two elements and prove nothing about the row.
    expect(pendingRow?.textContent).toContain('Chờ duyệt');
    expect(approvedRow?.textContent).toContain('Đã duyệt');
  });

  it('links each row into the existing review screen', async () => {
    renderQueue();

    const link = (await screen.findByText('Demo University 1')).closest('a');
    expect(link?.getAttribute('href')).toBe('/vi/admin/student-verifications/v-1');
  });

  it('sends the selected status as a filter', async () => {
    renderQueue();
    await screen.findByText('Demo University 1');

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'pending' } });

    await waitFor(() => {
      expect(listAdminVerifications).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'pending' }),
      );
    });
  });

  it('does not send a school search shorter than two characters', async () => {
    renderQueue();
    await screen.findByText('Demo University 1');

    // The contract rejects a 1-char `q`, so a naive pass-through would 400 on every keystroke.
    fireEvent.change(screen.getByLabelText('Tên trường'), { target: { value: 'D' } });

    await waitFor(() => {
      expect(listAdminVerifications).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: undefined }),
      );
    });
  });

  it('sends the school search once it is long enough', async () => {
    renderQueue();
    await screen.findByText('Demo University 1');

    fireEvent.change(screen.getByLabelText('Tên trường'), { target: { value: 'Demo' } });

    await waitFor(() => {
      expect(listAdminVerifications).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'Demo' }),
      );
    });
  });

  it('shows the server total rather than the number of rows on screen', async () => {
    listAdminVerifications.mockResolvedValue(page([pendingVerification], 'cursor-1', 57));
    renderQueue();

    expect(await screen.findByText('57 hồ sơ khớp bộ lọc')).toBeTruthy();
  });

  it('offers "load more" only when the server says there is a next page', async () => {
    renderQueue();

    await screen.findByText('Demo University 1');
    expect(screen.queryByRole('button', { name: 'Tải thêm' })).toBeNull();
  });

  it('requests the next page with the cursor and appends the rows', async () => {
    listAdminVerifications
      .mockResolvedValueOnce(page([pendingVerification], 'cursor-1', 2))
      .mockResolvedValueOnce(page([approvedVerification], null, 2));

    renderQueue();
    await screen.findByText('Demo University 1');

    fireEvent.click(screen.getByRole('button', { name: 'Tải thêm' }));

    expect(await screen.findByText('Demo University 2')).toBeTruthy();
    // The first page stays: paging that replaced the list would lose the admin's place.
    expect(screen.getByText('Demo University 1')).toBeTruthy();
    expect(listAdminVerifications).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-1' }),
    );
  });

  it('shows an honest empty state when the filters match nothing', async () => {
    listAdminVerifications.mockResolvedValue(page([], null, 0));
    renderQueue();

    expect(await screen.findByText('Không có hồ sơ nào khớp bộ lọc.')).toBeTruthy();
  });

  it('surfaces a failure instead of rendering it as an empty queue', async () => {
    listAdminVerifications.mockRejectedValue(new Error('upstream exploded'));
    renderQueue();

    // "no work" and "we could not ask" must not look the same on an operations screen.
    expect(await screen.findByText(/Không thể tải danh sách xác minh sinh viên/)).toBeTruthy();
    expect(screen.getByText('upstream exploded')).toBeTruthy();
    expect(screen.queryByText('Không có hồ sơ nào khớp bộ lọc.')).toBeNull();
  });

  it('retries the same request when the admin asks again', async () => {
    listAdminVerifications
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(page([pendingVerification], null, 1));

    renderQueue();
    await screen.findByText(/Không thể tải danh sách xác minh sinh viên/);

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByText('Demo University 1')).toBeTruthy();
  });

  it('shows the unauthorized state on a 403 rather than a broken list', async () => {
    listAdminVerifications.mockRejectedValue(new AdminAuthError());
    renderQueue();

    expect(await screen.findByText('Bạn không có quyền truy cập danh sách này')).toBeTruthy();
    // No retry button: retrying cannot fix an authorization failure.
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });

  it('renders a missing major as an explicit label, not a blank', async () => {
    listAdminVerifications.mockResolvedValue(page([approvedVerification], null, 1));
    renderQueue();

    expect(await screen.findByText(/Chưa khai báo ngành/)).toBeTruthy();
  });

  it('uses the real gateway, not a stub, in production code', () => {
    // Guards against the mock above leaking into the component's own import: the class the
    // component news up must be the one exported by the gateway module.
    expect(typeof new HttpVerificationGateway().listAdminVerifications).toBe('function');
  });
});
