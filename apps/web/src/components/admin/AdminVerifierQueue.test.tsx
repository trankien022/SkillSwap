import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import viMessages from '../../messages/vi.json';
import { AdminVerifierQueue } from './AdminVerifierQueue';
import { AdminAuthError } from '../../lib/verification/http-gateway';

/**
 * FR-015 / W2: the admin-wide Verifier queue.
 *
 * The risky part of this screen is not rendering rows — it is the domain filter.
 * The whole reason the queue exists is finding stranded work in a domain nobody
 * covers, so a filter that silently does not reach the request would leave a
 * screen that looks like an operations tool and answers nothing.
 */

const listAdminVerifierQueue = vi.fn();

vi.mock('../../lib/verification/http-gateway', async () => {
  const actual = await vi.importActual<typeof import('../../lib/verification/http-gateway')>(
    '../../lib/verification/http-gateway',
  );
  return {
    ...actual,
    HttpVerificationGateway: class {
      listAdminVerifierQueue = listAdminVerifierQueue;
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

const pendingEvidence = {
  id: 'e-1',
  profileSkillId: 'ps-1',
  skillId: 's-1',
  skillName: 'IELTS',
  category: 'Languages',
  ownerId: 'u-1',
  version: 1,
  evidenceType: 'certificate',
  documentRef: null,
  description: null,
  requestedLevel: 'advanced',
  approvedLevel: null,
  status: 'pending',
  claimedBy: null,
  claimedAt: null,
  reason: null,
  decidedAt: null,
  submittedAt: '2026-10-10T00:00:00.000Z',
};

const claimedEvidence = {
  ...pendingEvidence,
  id: 'e-2',
  skillName: null,
  category: null,
  requestedLevel: 'expert',
  status: 'claimed',
  claimedBy: 'verifier-9',
  version: 2,
};

function renderQueue() {
  return render(
    <NextIntlClientProvider locale="vi" messages={viMessages}>
      <AdminVerifierQueue />
    </NextIntlClientProvider>,
  );
}

describe('AdminVerifierQueue', () => {
  beforeEach(() => {
    listAdminVerifierQueue.mockResolvedValue(page([pendingEvidence, claimedEvidence], null, 2));
  });

  it('renders each item with skill, domain and status as text', async () => {
    renderQueue();

    const pendingRow = (await screen.findByText('IELTS')).closest('li');
    // The second row has no skill name, so it is reached by its claim line.
    const claimedRow = screen.getByText('Đang được thẩm định bởi verifier-9').closest('li');

    expect(pendingRow?.textContent).toContain('IELTS');
    expect(pendingRow?.textContent).toContain('Languages');
    // Scoped to the row: the same labels appear as filter <option>s in the toolbar,
    // so a document-wide query would prove nothing about the row itself.
    expect(pendingRow?.textContent).toContain('Chưa nhận');
    expect(claimedRow?.textContent).toContain('Đang thẩm định');
  });

  it('distinguishes unclaimed work from work in progress', async () => {
    renderQueue();

    // This distinction is the point of the screen: an old `pending` row means nobody
    // picked it up, an old `claimed` row means someone is stuck on it.
    expect(await screen.findByText('Chưa có Verifier nhận')).toBeTruthy();
    expect(screen.getByText('Đang được thẩm định bởi verifier-9')).toBeTruthy();
  });

  it('labels a missing skill and category instead of rendering blanks', async () => {
    renderQueue();

    await screen.findByText('IELTS');
    expect(screen.getByText('Không rõ kỹ năng')).toBeTruthy();
    expect(screen.getByText('Không rõ lĩnh vực')).toBeTruthy();
  });

  it('sends the domain filter to the request', async () => {
    renderQueue();
    await screen.findByText('IELTS');

    fireEvent.change(screen.getByLabelText('Lĩnh vực'), { target: { value: 'Languages' } });

    await waitFor(() => {
      expect(listAdminVerifierQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ domain: 'Languages' }),
      );
    });
  });

  it('does not send a domain filter shorter than two characters', async () => {
    renderQueue();
    await screen.findByText('IELTS');

    // The contract rejects a 1-char `domain`; passing it through would 400 on each keystroke.
    fireEvent.change(screen.getByLabelText('Lĩnh vực'), { target: { value: 'L' } });

    await waitFor(() => {
      expect(listAdminVerifierQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ domain: undefined }),
      );
    });
  });

  it('defaults to oldest-first, so stranded work surfaces', async () => {
    renderQueue();

    await screen.findByText('IELTS');
    expect(listAdminVerifierQueue).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'submittedAt' }),
    );
  });

  it('opens on live work, not on every row ever submitted', async () => {
    renderQueue();

    await screen.findByText('IELTS');
    // One request carrying both live statuses: two requests merged in the client would show a
    // `total` matching neither, and that total is how an admin judges the backlog.
    expect(listAdminVerifierQueue).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending,claimed' }),
    );
  });

  it('sends the selected status as a filter', async () => {
    renderQueue();
    await screen.findByText('IELTS');

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'claimed' } });

    await waitFor(() => {
      expect(listAdminVerifierQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'claimed' }),
      );
    });
  });

  it('keeps the decided statuses reachable', async () => {
    renderQueue();
    await screen.findByText('IELTS');

    // "What was rejected in this domain" is a real question; it is just not what a queue opens on.
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'rejected' } });

    await waitFor(() => {
      expect(listAdminVerifierQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'rejected' }),
      );
    });
  });

  it('shows the server total, not the number of rendered rows', async () => {
    listAdminVerifierQueue.mockResolvedValue(page([pendingEvidence], 'cursor-1', 44));
    renderQueue();

    expect(await screen.findByText('44 bằng chứng khớp bộ lọc')).toBeTruthy();
  });

  it('appends the next page and keeps the rows already shown', async () => {
    listAdminVerifierQueue
      .mockResolvedValueOnce(page([pendingEvidence], 'cursor-1', 2))
      .mockResolvedValueOnce(page([claimedEvidence], null, 2));

    renderQueue();
    await screen.findByText('IELTS');

    fireEvent.click(screen.getByRole('button', { name: 'Tải thêm' }));

    expect(await screen.findByText('Không rõ kỹ năng')).toBeTruthy();
    expect(screen.getByText('IELTS')).toBeTruthy();
    expect(listAdminVerifierQueue).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-1' }),
    );
  });

  it('offers "load more" only when there is a next page', async () => {
    renderQueue();

    await screen.findByText('IELTS');
    expect(screen.queryByRole('button', { name: 'Tải thêm' })).toBeNull();
  });

  it('shows an empty state rather than a blank screen when nothing matches', async () => {
    listAdminVerifierQueue.mockResolvedValue(page([], null, 0));
    renderQueue();

    expect(await screen.findByText('Không có bằng chứng nào khớp bộ lọc.')).toBeTruthy();
  });

  it('surfaces a failure instead of presenting it as an empty queue', async () => {
    listAdminVerifierQueue.mockRejectedValue(new Error('audit upstream down'));
    renderQueue();

    expect(await screen.findByText(/Không thể tải hàng đợi thẩm định/)).toBeTruthy();
    expect(screen.getByText('audit upstream down')).toBeTruthy();
    expect(screen.queryByText('Không có bằng chứng nào khớp bộ lọc.')).toBeNull();
  });

  it('shows the unauthorized state on a 403, with no pointless retry', async () => {
    listAdminVerifierQueue.mockRejectedValue(new AdminAuthError());
    renderQueue();

    expect(await screen.findByText('Bạn không có quyền truy cập hàng đợi này')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Thử lại' })).toBeNull();
  });

  it('does not render a decision control on a triage screen', async () => {
    renderQueue();
    await screen.findByText('IELTS');

    // Deciding lives on the Verifier surface. Two decide paths for one row is how a
    // queue and a detail view start disagreeing.
    expect(screen.queryByRole('button', { name: /Phê duyệt|Từ chối/ })).toBeNull();
  });
});
