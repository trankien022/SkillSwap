import { describe, expect, it } from 'vitest';
import { ApiError, unwrapEnvelope, type ApiEnvelope } from './api-client';

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
