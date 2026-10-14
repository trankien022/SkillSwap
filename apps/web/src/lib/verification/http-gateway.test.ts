import { afterEach, describe, expect, it, vi } from 'vitest';
import { envelopeOk } from '@skillswap/contracts';
import { AdminAuthError, HttpVerificationGateway } from './http-gateway';

const STATUS_BODY = envelopeOk({
  accountId: 'acc-1234',
  status: 'suspended',
  expertise: ['skill-cloud-1', 'skill-frontend-1'],
});

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HttpVerificationGateway.setVerifierStatus', () => {
  it('POSTs the status change and parses the updated VerifierView', async () => {
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      expect(url).toContain('/api/verifiers/acc-1234/status');
      expect(init.method).toBe('POST');
      expect(JSON.parse(String(init.body))).toEqual({ status: 'suspended' });
      return Promise.resolve(jsonResponse(STATUS_BODY));
    });
    vi.stubGlobal('fetch', fetchMock);

    const view = await new HttpVerificationGateway().setVerifierStatus('acc-1234', {
      status: 'suspended',
    });

    expect(view).toEqual({
      accountId: 'acc-1234',
      status: 'suspended',
      expertise: ['skill-cloud-1', 'skill-frontend-1'],
    });
  });

  it('encodes the accountId so a UUID-like value still routes correctly', async () => {
    const fetchMock = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve(jsonResponse(STATUS_BODY)),
    );
    vi.stubGlobal('fetch', fetchMock);

    await new HttpVerificationGateway().setVerifierStatus('acc/with-slash', {
      status: 'active',
    });

    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const url = (call?.[0] ?? '') as string;
    expect(url).toContain('/api/verifiers/acc%2Fwith-slash/status');
  });

  it('throws AdminAuthError on 401 (session gone) and 403 (not an admin)', async () => {
    for (const status of [401, 403]) {
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve(
            jsonResponse(
              { success: false, code: 'Forbidden', message: 'nope', data: null, errors: [] },
              status,
            ),
          ),
        ),
      );
      await expect(
        new HttpVerificationGateway().setVerifierStatus('acc-1234', { status: 'active' }),
      ).rejects.toBeInstanceOf(AdminAuthError);
    }
  });

  it('rejects unknown status values locally before sending the request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      // Cast to bypass the type checker on purpose — we want the runtime guard.
      new HttpVerificationGateway().setVerifierStatus('acc-1234', {
        status: 'unknown' as never,
      }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an empty accountId before sending the request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new HttpVerificationGateway().setVerifierStatus('   ', { status: 'active' }),
    ).rejects.toThrow(/Account id is required/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
