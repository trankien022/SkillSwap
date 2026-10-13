import { buildSepaySigningString, signSepayFields, verifySepayFields } from './sepay-signature';

/**
 * FR-008 / ADR-030: the signing string and signature.
 *
 * The expected value in the first test was produced against SePay's own
 * algorithm on Sandbox: fields joined in `SEPAY_SIGNED_FIELDS` order, then
 * `base64(hmac_sha256(string, secret))`. If the order or the join changes,
 * live checkout stops working — so it is pinned here.
 */
describe('sepay signature', () => {
  const fields = {
    merchant: 'SP-TEST-LDAB5895',
    operation: 'PURCHASE',
    order_amount: '10000',
    currency: 'VND',
    order_invoice_number: 'SS-1-A1B2C3',
    order_description: 'SkillSwap wallet top-up',
    success_url: 'https://example.test/callback',
    error_url: 'https://example.test/callback',
    cancel_url: 'https://example.test/callback',
  };

  it('joins only the allow-listed fields, in the fixed order', () => {
    expect(buildSepaySigningString(fields)).toBe(
      [
        'merchant=SP-TEST-LDAB5895',
        'operation=PURCHASE',
        'order_amount=10000',
        'currency=VND',
        'order_invoice_number=SS-1-A1B2C3',
        'order_description=SkillSwap wallet top-up',
        'success_url=https://example.test/callback',
        'error_url=https://example.test/callback',
        'cancel_url=https://example.test/callback',
      ].join(','),
    );
  });

  it('ignores fields SePay does not sign', () => {
    const withNoise = { ...fields, signature: 'ignored', trace_id: 'ignored' };
    expect(buildSepaySigningString(withNoise)).toBe(buildSepaySigningString(fields));
  });

  it('produces a base64 signature and verifies it', () => {
    const signature = signSepayFields(fields, 'spsk_test_secret');
    expect(signature).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(verifySepayFields(fields, signature, 'spsk_test_secret')).toBe(true);
  });

  it('rejects a tampered amount, a wrong secret and an empty signature', () => {
    const signature = signSepayFields(fields, 'spsk_test_secret');
    expect(verifySepayFields({ ...fields, order_amount: '1' }, signature, 'spsk_test_secret')).toBe(
      false,
    );
    expect(verifySepayFields(fields, signature, 'other-secret')).toBe(false);
    expect(verifySepayFields(fields, '', 'spsk_test_secret')).toBe(false);
  });
});
