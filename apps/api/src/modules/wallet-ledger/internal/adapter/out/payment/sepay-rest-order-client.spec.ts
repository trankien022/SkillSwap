import { SepayRestOrderClient } from './sepay-rest-order-client';

/**
 * FR-008 / ADR-033: the reconciliation order reader.
 *
 * This adapter had no test, which is how it shipped calling `/v1/orders` — a path the host does
 * not serve — while the reconciliation sweeper sat disabled behind `SEPAY_RECON_ENABLED=false`.
 * The URL assertion below is the regression test for that: it is the one thing that was wrong and
 * the one thing nothing was checking.
 */

function config(overrides: Partial<Record<string, string>> = {}) {
  return {
    sepayRestBaseUrl: 'https://pgapi-sandbox.sepay.vn',
    sepaySecretKey: 'rest-key',
    ...overrides,
  } as unknown as ConstructorParameters<typeof SepayRestOrderClient>[0];
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as unknown as Response;
}

function htmlResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON');
    },
    text: async () => '<html><body>404 Not Found</body></html>',
    headers: new Headers({ 'content-type': 'text/html; charset=UTF-8' }),
  } as unknown as Response;
}

describe('SepayRestOrderClient', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests the singular /v1/order path the host actually serves', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));

    await new SepayRestOrderClient(config()).findByInvoiceNumber('SS-1');

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/v1/order?');
    // The plural form is the defect: it answers the host's HTML 404 page, not JSON.
    expect(url).not.toContain('/v1/orders');
  });

  it('encodes the invoice number into the query rather than concatenating it raw', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));

    await new SepayRestOrderClient(config()).findByInvoiceNumber('SS 1&x=2/../y');

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('order_invoice_number=SS%201%26x%3D2%2F..%2Fy');
  });

  it('sends the secret as a bearer token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [] }));

    await new SepayRestOrderClient(config({ sepaySecretKey: 's3cret' })).findByInvoiceNumber('SS-1');

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: expect.objectContaining({ Authorization: 'Bearer s3cret' }),
    });
  });

  it('returns null on 404 instead of throwing: an absent order is "nothing to reconcile"', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ messages: 'not found' }, 404));

    await expect(new SepayRestOrderClient(config()).findByInvoiceNumber('SS-1')).resolves.toBeNull();
  });

  it('names an auth failure as an auth failure, not as a provider outage', async () => {
    // The sandbox answers exactly this shape for the Payment Gateway secret, because the Order API
    // needs a different key. 401 and 500 mean different things to whoever is reading the log.
    fetchMock.mockResolvedValue(jsonResponse({ status: 401, error: 401 }, 401));

    await expect(
      new SepayRestOrderClient(config()).findByInvoiceNumber('SS-1'),
    ).rejects.toThrow(/401|credential|auth/i);
  });

  it('reads a row whose fields are the documented ones', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [
          {
            order_invoice_number: 'SS-1',
            order_id: 42,
            order_status: 'CAPTURED',
            order_amount: '10000.00',
            transaction_date: '2026-10-14 09:30:00',
          },
        ],
      }),
    );

    const result = await new SepayRestOrderClient(config()).findByInvoiceNumber('SS-1');

    expect(result).toMatchObject({
      providerRef: 'SS-1',
      providerOrderId: '42',
      status: 'settled',
      paidAmountVnd: 10000,
    });
    expect(result?.paidAt).toBeInstanceOf(Date);
  });

  it('picks the matching row when the provider returns several', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [
          { order_invoice_number: 'OTHER', order_status: 'CAPTURED' },
          { order_invoice_number: 'SS-1', order_status: 'PAID' },
        ],
      }),
    );

    const result = await new SepayRestOrderClient(config()).findByInvoiceNumber('SS-1');

    expect(result?.providerRef).toBe('SS-1');
  });

  it('degrades an unknown status to pending rather than guessing a settlement', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: [{ order_invoice_number: 'SS-1', order_status: 'WHAT_IS_THIS' }] }),
    );

    const result = await new SepayRestOrderClient(config()).findByInvoiceNumber('SS-1');

    // "pending" means "do not credit anything yet", which is the safe direction for money.
    expect(result?.status).toBe('pending');
  });

  it('tolerates a bare array body, as the sandbox has been seen to send', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([{ order_invoice_number: 'SS-1', order_status: 'CAPTURED' }]),
    );

    const result = await new SepayRestOrderClient(config()).findByInvoiceNumber('SS-1');

    expect(result?.status).toBe('settled');
  });

  it('does not treat an HTML error page as an empty result', async () => {
    // The old bug's shape: a wrong path returns HTML 404. If the client swallowed that as "no
    // order", a stuck intent would look reconciled forever.
    fetchMock.mockResolvedValue(htmlResponse(200));

    await expect(
      new SepayRestOrderClient(config()).findByInvoiceNumber('SS-1'),
    ).rejects.toThrow();
  });
});
