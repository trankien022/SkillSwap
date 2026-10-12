import { describe, expect, it } from 'vitest';
import {
  ApiError,
  unwrapEnvelope,
  getStoredWalletBalance,
  dispatchWalletBalanceUpdate,
  WALLET_BALANCE_STORAGE_KEY,
  WALLET_BALANCE_EVENT,
  type ApiEnvelope,
} from './api-client';
import type { WalletBalanceView } from '@skillswap/contracts';

function res(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('unwrapEnvelope (NFR-013)', () => {
  it('returns the data payload of a success envelope', async () => {
    const envelope: ApiEnvelope<{ items: number[] }> = {
      success: true,
      code: 'WALLET_HISTORY_OK',
      message: 'Wallet history loaded',
      data: { items: [1, 2] },
      errors: [],
    };
    await expect(unwrapEnvelope<{ items: number[] }>(res(envelope))).resolves.toEqual({
      items: [1, 2],
    });
  });

  it('throws an ApiError carrying the stable code on a failure envelope', async () => {
    const envelope: ApiEnvelope<null> = {
      success: false,
      code: 'ReasonRequiredError',
      message: 'A rejection requires a reason',
      data: null,
      errors: [{ code: 'ReasonRequiredError', message: 'A rejection requires a reason' }],
    };
    let caught: unknown;
    try {
      await unwrapEnvelope(res(envelope, 409));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).code).toBe('ReasonRequiredError');
    expect((caught as ApiError).errors).toHaveLength(1);
  });

  it('throws HTTP_<status> for a non-enveloped error response', async () => {
    await expect(unwrapEnvelope(res({}, 500))).rejects.toMatchObject({ code: 'HTTP_500' });
  });
});

describe('wallet balance is server-owned state', () => {
  it('never returns a cached balance, and purges any value a previous revision left behind', () => {
    window.localStorage.setItem(
      WALLET_BALANCE_STORAGE_KEY,
      JSON.stringify({ availableCredits: 99999, pendingCredits: 0 }),
    );

    // A stale cached balance must not be surfaced as if it were the truth.
    expect(getStoredWalletBalance()).toBeNull();
    // ...and it must be erased so it cannot mislead a later reader either.
    expect(window.localStorage.getItem(WALLET_BALANCE_STORAGE_KEY)).toBeNull();
  });

  it('broadcasts a fresh balance without persisting it', () => {
    const received: WalletBalanceView[] = [];
    const listener = (e: Event) => {
      received.push((e as CustomEvent<WalletBalanceView>).detail);
    };
    window.addEventListener(WALLET_BALANCE_EVENT, listener);

    dispatchWalletBalanceUpdate({ availableCredits: 400, pendingCredits: 100 });
    window.removeEventListener(WALLET_BALANCE_EVENT, listener);

    expect(received).toEqual([{ availableCredits: 400, pendingCredits: 100 }]);
    expect(window.localStorage.getItem(WALLET_BALANCE_STORAGE_KEY)).toBeNull();
  });
});
