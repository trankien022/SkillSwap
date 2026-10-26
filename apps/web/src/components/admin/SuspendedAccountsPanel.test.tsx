import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import viMessages from '../../messages/vi.json';
import enMessages from '../../messages/en.json';
import { SuspendedAccountsPanel, SuspendedAccountsSection } from './SuspendedAccountsPanel';
import { SuspendAccountForm } from './SuspendAccountForm';
import { AdminAuthError } from '../../lib/verification/http-gateway';

/**
 * FR-015 / AC-033 / ADR-037: the account-lock screen.
 *
 * The property this suite exists to protect is the one AC-033 names: a permission
 * failure must never look like an answer. "No account is locked" and "you may not
 * see this" are opposite facts, and an empty list renders them identically — so the
 * unauthorized path is tested against the *empty* rendering, not just for "shows a
 * message somewhere".
 *
 * The second property is that a release does not ask for a reason. ADR-037 rejects a
 * reason on a reinstatement, so a form field for one would collect input the server
 * refuses.
 */

const listSuspendedAccounts = vi.fn();
const reinstateAccount = vi.fn();
const suspendAccount = vi.fn();

vi.mock('../../lib/verification/http-gateway', async () => {
  const actual = await vi.importActual<typeof import('../../lib/verification/http-gateway')>(
    '../../lib/verification/http-gateway',
  );
  return {
    ...actual,
    HttpVerificationGateway: class {
      listSuspendedAccounts = listSuspendedAccounts;
      reinstateAccount = reinstateAccount;
      suspendAccount = suspendAccount;
    },
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const ACCOUNT = '7c1e0000-0000-4000-8000-0000000000b2';
const ADMIN = '7c1e0000-0000-4000-8000-0000000000a1';

function page(items: unknown[], total = items.length) {
  return { items, page: { limit: 50, total, nextCursor: null } };
}

function lockedRow(overrides: Record<string, unknown> = {}) {
  return {
    accountId: ACCOUNT,
    email: 'minh@skillswap.test',
    displayName: 'Minh',
    role: 'user',
    reason: 'Repeated payment fraud',
    suspendedBy: ADMIN,
    suspendedAt: '2026-10-26T09:00:00.000Z',
    ...overrides,
  };
}

function renderPanel(props: { reloadKey?: number } = {}) {
  return render(
    <NextIntlClientProvider locale="vi" messages={viMessages}>
      <SuspendedAccountsPanel {...props} />
    </NextIntlClientProvider>,
  );
}

function renderForm(onSuspended = vi.fn()) {
  return {
    onSuspended,
    ...render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <SuspendAccountForm onSuspended={onSuspended} />
      </NextIntlClientProvider>,
    ),
  };
}

describe('SuspendedAccountsPanel', () => {
  beforeEach(() => {
    listSuspendedAccounts.mockReset();
    reinstateAccount.mockReset();
  });

  it('lists a locked account with its reason and the Administrator who applied it', async () => {
    listSuspendedAccounts.mockResolvedValue(page([lockedRow()]));
    renderPanel();

    expect(await screen.findByText('Minh')).toBeTruthy();
    // The reason and the actor are the two things ADR-037 requires be shown.
    expect(screen.getByText('Repeated payment fraud')).toBeTruthy();
    expect(screen.getByText(ADMIN)).toBeTruthy();
    // Status is text, not colour alone (DESIGN.md).
    expect(screen.getByText('Đã khóa')).toBeTruthy();
  });

  it('does not read as an empty list when the API refuses (AC-033)', async () => {
    listSuspendedAccounts.mockRejectedValue(new AdminAuthError());
    renderPanel();

    expect(await screen.findByText('Bạn không có quyền xem danh sách tài khoản bị khóa')).toBeTruthy();
    // The decisive assertion: the reassuring empty state must be absent, because a
    // non-admin who saw it would have been told nobody is locked.
    expect(screen.queryByTestId('suspended-accounts-empty')).toBeNull();
    expect(screen.queryByTestId('suspended-accounts')).toBeNull();
  });

  it('says "nobody is locked" only after the API actually said so', async () => {
    listSuspendedAccounts.mockResolvedValue(page([]));
    renderPanel();

    expect(await screen.findByTestId('suspended-accounts-empty')).toBeTruthy();
  });

  it('shows a failure as a failure rather than as zero locked accounts', async () => {
    listSuspendedAccounts.mockRejectedValue(new Error('gateway down'));
    renderPanel();

    expect(await screen.findByTestId('suspended-accounts-failed')).toBeTruthy();
    expect(screen.queryByTestId('suspended-accounts-empty')).toBeNull();
  });

  it('asks before releasing, then reloads from the server', async () => {
    listSuspendedAccounts.mockResolvedValue(page([lockedRow()]));
    reinstateAccount.mockResolvedValue({
      accountId: ACCOUNT,
      status: 'active',
      changed: true,
      reason: null,
    });
    renderPanel();

    fireEvent.click(await screen.findByText('Mở khóa'));
    // Nothing is sent until the confirmation is accepted: a lock is easy to undo, but
    // an operator clicking the wrong row should still get a second look.
    expect(reinstateAccount).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Có, mở khóa'));

    await waitFor(() => expect(reinstateAccount).toHaveBeenCalledWith(ACCOUNT));
    // Reload, not a local splice: the list is the record of who is locked.
    await waitFor(() => expect(listSuspendedAccounts).toHaveBeenCalledTimes(2));
    // A release carries no reason; the gateway takes none.
    expect(reinstateAccount.mock.calls[0]).toHaveLength(1);
  });

  it('reports a failed release without dropping the row', async () => {
    listSuspendedAccounts.mockResolvedValue(page([lockedRow()]));
    reinstateAccount.mockRejectedValue(new Error('nope'));
    renderPanel();

    fireEvent.click(await screen.findByText('Mở khóa'));
    fireEvent.click(screen.getByText('Có, mở khóa'));

    expect(await screen.findByTestId('release-error')).toBeTruthy();
    // The account is still locked, and the screen must still say so.
    expect(screen.getByText('Minh')).toBeTruthy();
  });

  it('reloads when the section tells it something changed', async () => {
    listSuspendedAccounts.mockResolvedValue(page([lockedRow()]));
    const { rerender } = renderPanel({ reloadKey: 0 });
    await screen.findByText('Minh');

    rerender(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <SuspendedAccountsPanel reloadKey={1} />
      </NextIntlClientProvider>,
    );

    await waitFor(() => expect(listSuspendedAccounts).toHaveBeenCalledTimes(2));
  });
});

describe('SuspendAccountForm', () => {
  beforeEach(() => {
    suspendAccount.mockReset();
  });

  it('refuses a blank reason before sending anything (ADR-037 decision 2)', async () => {
    const { onSuspended } = renderForm();

    fireEvent.change(screen.getByLabelText('Account ID'), { target: { value: ACCOUNT } });
    fireEvent.change(screen.getByLabelText('Lý do khóa'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Khóa tài khoản'));

    expect(screen.getByText('Bắt buộc phải có lý do và không được để trống.')).toBeTruthy();
    // Not even attempted: a reasonless lock must never reach the server.
    expect(suspendAccount).not.toHaveBeenCalled();
    expect(onSuspended).not.toHaveBeenCalled();
  });

  it('refuses a blank account id', async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText('Lý do khóa'), { target: { value: 'Fraud' } });
    fireEvent.click(screen.getByText('Khóa tài khoản'));

    expect(screen.getByText('Vui lòng nhập account ID.')).toBeTruthy();
    expect(suspendAccount).not.toHaveBeenCalled();
  });

  it('sends the trimmed reason and tells the list to reload', async () => {
    suspendAccount.mockResolvedValue({
      accountId: ACCOUNT,
      status: 'suspended',
      changed: true,
      reason: 'Repeated payment fraud',
    });
    const { onSuspended } = renderForm();

    fireEvent.change(screen.getByLabelText('Account ID'), { target: { value: ` ${ACCOUNT} ` } });
    fireEvent.change(screen.getByLabelText('Lý do khóa'), {
      target: { value: '  Repeated payment fraud  ' },
    });
    fireEvent.click(screen.getByText('Khóa tài khoản'));

    await waitFor(() =>
      expect(suspendAccount).toHaveBeenCalledWith(ACCOUNT, { reason: 'Repeated payment fraud' }),
    );
    expect(onSuspended).toHaveBeenCalled();
    expect(await screen.findByTestId('suspend-done')).toBeTruthy();
  });

  it('reports a permission failure in words an operator can act on', async () => {
    suspendAccount.mockRejectedValue(new AdminAuthError());
    renderForm();

    fireEvent.change(screen.getByLabelText('Account ID'), { target: { value: ACCOUNT } });
    fireEvent.change(screen.getByLabelText('Lý do khóa'), { target: { value: 'Fraud' } });
    fireEvent.click(screen.getByText('Khóa tài khoản'));

    expect(await screen.findByTestId('suspend-error')).toBeTruthy();
    expect(
      screen.getByText(
        'Bạn không được phép thực hiện hành động này. Hãy đăng nhập bằng tài khoản quản trị.',
      ),
    ).toBeTruthy();
  });
});

describe('SuspendedAccountsSection', () => {
  it('composes the form and the list', async () => {
    listSuspendedAccounts.mockResolvedValue(page([]));
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SuspendedAccountsSection />
      </NextIntlClientProvider>,
    );

    // English locale renders English copy; vn/en are never mixed on one screen.
    expect(await screen.findByText('Lock an account')).toBeTruthy();
    expect(screen.getByText('No account is locked right now.')).toBeTruthy();
  });
});
