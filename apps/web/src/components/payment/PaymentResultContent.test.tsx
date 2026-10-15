import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import viMessages from '../../messages/vi.json';
import { PaymentResultContent } from './PaymentResultContent';

/**
 * FR-008 / ADR-033: SePay's redirect settles nothing, and the browser can be
 * sent back for a success, an error or a cancellation alike. The page therefore
 * has to read the outcome from the server, and must never infer it from having
 * been reached at all.
 */

const callApiOk = vi.fn();

vi.mock('../../lib/api-client', () => ({
  callApiOk: (...args: unknown[]) => callApiOk(...args) as unknown,
  dispatchWalletBalanceUpdate: () => {},
  unwrapEnvelope: async (res: unknown) => await (res as { json(): Promise<unknown> }).json(),
}));

function json(body: unknown): unknown {
  return { json: async () => body };
}

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="vi" messages={viMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  callApiOk.mockReset();
});

afterEach(() => {
  // jsdom has no automatic cleanup registered in this workspace, so without
  // this each render would stack on the previous test's DOM.
  cleanup();
  vi.restoreAllMocks();
});

describe('PaymentResultContent', () => {
  it('reads the intent by invoice number and reports the status the server has', async () => {
    callApiOk.mockImplementation(async (path: string) => {
      if (path.startsWith('/wallet/top-ups/by-provider-ref/')) {
        return json({
          id: 'i-1',
          ownerId: 'u-1',
          provider: 'sepay',
          providerRef: 'SS-1-A1B2C3',
          amountVnd: 100_000,
          amountCredits: 100,
          status: 'pending',
          paidAmountVnd: null,
          paidAt: null,
        });
      }
      return json({ ownerId: 'u-1', availableCredits: 40, holdCredits: 0, totalCredits: 40 });
    });

    renderWithIntl(<PaymentResultContent intentId={null} providerRef="SS-1-A1B2C3" />);

    await waitFor(() => {
      expect(screen.getByTestId('payment-result-status')).toBeDefined();
    });

    // The invoice number travels on SePay's redirect, not the intent id.
    expect(callApiOk).toHaveBeenCalledWith(
      '/wallet/top-ups/by-provider-ref/SS-1-A1B2C3',
    );
    // A pending intent is reported as pending: the redirect proves nothing.
    expect(screen.getByTestId('payment-result-status').textContent).toBe(
      'Đang chờ SePay xác nhận',
    );
  });

  it('prefers the intent id when no invoice number is present', async () => {
    callApiOk.mockImplementation(async (path: string) => {
      if (path.startsWith('/wallet/top-ups/')) {
        return json({
          id: 'i-9',
          ownerId: 'u-1',
          provider: 'sepay',
          providerRef: 'SS-9-ZZZZZZ',
          amountVnd: 50_000,
          amountCredits: 50,
          status: 'settled',
          paidAmountVnd: 50_000,
          paidAt: '2026-10-15T02:00:00.000Z',
        });
      }
      return json({ ownerId: 'u-1', availableCredits: 90, holdCredits: 0, totalCredits: 90 });
    });

    renderWithIntl(<PaymentResultContent intentId="i-9" providerRef={null} />);

    await waitFor(() => {
      expect(screen.getByTestId('payment-result-status').textContent).toBe('Đã cộng vào ví');
    });
    expect(callApiOk).toHaveBeenCalledWith('/wallet/top-ups/i-9');
  });

  it('says so, and reads no intent, when the link carries no handle at all', async () => {
    callApiOk.mockResolvedValue(
      json({ ownerId: 'u-1', availableCredits: 0, holdCredits: 0, totalCredits: 0 }),
    );

    renderWithIntl(<PaymentResultContent intentId={null} providerRef={null} />);

    await waitFor(() => {
      expect(screen.getByTestId('payment-result-no-intent')).toBeDefined();
    });
    // Only the balance is read; there is nothing to look up.
    expect(callApiOk).toHaveBeenCalledTimes(1);
    expect(callApiOk).toHaveBeenCalledWith('/wallet/balance');
  });

  it('reports a failed intent read without claiming a payment outcome', async () => {
    callApiOk.mockImplementation(async (path: string) => {
      if (path.startsWith('/wallet/top-ups/')) {
        throw new Error('boom');
      }
      return json({ ownerId: 'u-1', availableCredits: 10, holdCredits: 0, totalCredits: 10 });
    });

    renderWithIntl(<PaymentResultContent intentId={null} providerRef="SS-2-B" />);

    await waitFor(() => {
      expect(screen.getByTestId('payment-result-intent-error')).toBeDefined();
    });
    // The unknown status is shown as unknown, never as settled.
    expect(screen.getByTestId('payment-result-status').textContent).toBe('Không xác định');
  });
});
