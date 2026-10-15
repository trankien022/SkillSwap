import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  ApiError,
  ApiResponseError,
  apiFailureCode,
  callApiOk,
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('callApiOk', () => {
  it('resolves with the response on a 2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ ok: true }, 200));

    const out = await callApiOk('/anything');
    expect(out.status).toBe(200);
  });

  it('throws instead of returning a non-2xx, so a forgotten `else` cannot swallow it', async () => {
    // The class of bug this exists for: `if (res.ok) { setState(...) }` with no
    // else turned every 4xx/5xx into a screen that silently never updated.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      res({ success: false, code: 'BOOM', message: 'Exploded', data: null, errors: [] }, 500),
    );

    await expect(callApiOk('/anything')).rejects.toBeInstanceOf(ApiResponseError);
  });

  it('classifies 401 as UNAUTHORIZED and carries the server message', async () => {
    // The identity guard answers 401 with a bare `{ statusCode, message }`, not
    // an envelope, so the status — not the body shape — must decide the code.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      res({ statusCode: 401, message: 'Missing bearer token' }, 401),
    );

    const error = await callApiOk('/auth/me').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiResponseError);
    expect((error as ApiResponseError).code).toBe('UNAUTHORIZED');
    expect((error as ApiResponseError).message).toBe('Missing bearer token');
  });

  it('classifies 403 as FORBIDDEN and anything else as HTTP_<status>', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ message: 'nope' }, 403));
    const forbidden = await callApiOk('/verifiers/me/queue').catch((e: unknown) => e);
    expect((forbidden as ApiResponseError).code).toBe('FORBIDDEN');

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ message: 'bad uuid' }, 400));
    const invalid = await callApiOk('/classes/not-a-uuid').catch((e: unknown) => e);
    expect((invalid as ApiResponseError).code).toBe('HTTP_400');
  });

  it('falls back to the status when the failure body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>502 Bad Gateway</html>', {
        status: 502,
        headers: { 'content-type': 'text/html' },
      }),
    );

    const error = await callApiOk('/anything').catch((e: unknown) => e);
    expect((error as ApiResponseError).code).toBe('HTTP_502');
    expect((error as ApiResponseError).message).toContain('502');
  });

  it('does not consume the body, so the caller can still parse it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(res({ success: false, message: 'x' }, 409));
    const error = await callApiOk('/anything').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiResponseError);
  });
});

describe('apiFailureCode', () => {
  it('maps the three semantic statuses and defers the rest to the shared helper', () => {
    expect(apiFailureCode(401)).toBe('UNAUTHORIZED');
    expect(apiFailureCode(403)).toBe('FORBIDDEN');
    expect(apiFailureCode(404)).toBe('HTTP_404');
    expect(apiFailureCode(500)).toBe('HTTP_500');
  });
});


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
