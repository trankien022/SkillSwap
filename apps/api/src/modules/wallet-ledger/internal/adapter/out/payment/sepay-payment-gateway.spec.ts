import type { ApiConfig } from '../../../../../../shared/config/api-config';
import { SepayPaymentGateway } from './sepay-payment-gateway';
import { signSepayFields } from './sepay-signature';

/**
 * FR-008 / ADR-033 (design B): the API submits the signed checkout form and
 * returns the `302` `Location` as the payment URL. These tests pin that
 * contract without touching the network.
 */
function config(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    sepayCheckoutHost: 'https://pay-sandbox.sepay.vn',
    sepayMerchantId: 'SP-TEST-LDAB5895',
    sepaySecretKey: 'spsk_test_secret',
    sepayReturnUrl: 'https://example.test/api/wallet/top-ups/callback',
    ...overrides,
  } as ApiConfig;
}

describe('SepayPaymentGateway', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function stubFetch(response: Response): jest.Mock {
    const mock = jest.fn().mockResolvedValue(response);
    global.fetch = mock as unknown as typeof fetch;
    return mock;
  }

  it('returns the hosted checkout URL from the 302 Location', async () => {
    const hosted = 'https://pay-sandbox.sepay.vn/v1/checkout?merchant=SP-TEST-LDAB5895&order_id=PAY1';
    stubFetch(new Response(null, { status: 302, headers: { location: hosted } }));

    const gateway = new SepayPaymentGateway(config());
    const result = await gateway.initiateTopUp({
      providerRef: 'SS-1-A1B2C3',
      amountVnd: 10000,
      description: 'SkillSwap wallet top-up SS-1-A1B2C3',
    });

    expect(result.paymentUrl).toBe(hosted);
    expect(gateway.provider).toBe('sepay');
  });

  it('posts a correctly signed form to the checkout host', async () => {
    const fetchMock = stubFetch(
      new Response(null, { status: 302, headers: { location: 'https://pay-sandbox.sepay.vn/v1/checkout' } }),
    );

    await new SepayPaymentGateway(config()).initiateTopUp({
      providerRef: 'SS-2-B2C3D4',
      amountVnd: 50000,
      description: 'SkillSwap wallet top-up SS-2-B2C3D4',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://pay-sandbox.sepay.vn/v1/checkout/init');
    expect(init.method).toBe('POST');
    // Design B: never follow the redirect; the Location *is* the result.
    expect(init.redirect).toBe('manual');

    const params = new URLSearchParams(init.body as string);
    const fields: Record<string, string> = {};
    for (const [key, value] of params.entries()) fields[key] = value;

    expect(fields.merchant).toBe('SP-TEST-LDAB5895');
    expect(fields.operation).toBe('PURCHASE');
    expect(fields.order_amount).toBe('50000');
    expect(fields.currency).toBe('VND');
    expect(fields.order_invoice_number).toBe('SS-2-B2C3D4');
    expect(fields.success_url).toBe('https://example.test/api/wallet/top-ups/callback');
    expect(fields.error_url).toBe(fields.success_url);
    expect(fields.cancel_url).toBe(fields.success_url);
    // The signature is over the fields as sent (minus the signature itself).
    expect(fields.signature).toBe(signSepayFields(fields, 'spsk_test_secret'));
    // No payment_method: the payer chooses on SePay's page.
    expect(fields.payment_method).toBeUndefined();
  });

  it('trims a trailing slash from the configured checkout host', async () => {
    const fetchMock = stubFetch(
      new Response(null, { status: 302, headers: { location: 'https://pay.sepay.vn/v1/checkout' } }),
    );

    await new SepayPaymentGateway(config({ sepayCheckoutHost: 'https://pay.sepay.vn/' })).initiateTopUp({
      providerRef: 'SS-3',
      amountVnd: 10000,
      description: 'top-up',
    });

    expect(fetchMock.mock.calls[0][0]).toBe('https://pay.sepay.vn/v1/checkout/init');
  });

  it('throws when SePay does not redirect, rather than returning a dead URL', async () => {
    stubFetch(new Response('invalid signature', { status: 200 }));

    await expect(
      new SepayPaymentGateway(config()).initiateTopUp({
        providerRef: 'SS-4',
        amountVnd: 10000,
        description: 'top-up',
      }),
    ).rejects.toThrow(/SePay checkout init failed \(HTTP 200\)/);
  });
});
