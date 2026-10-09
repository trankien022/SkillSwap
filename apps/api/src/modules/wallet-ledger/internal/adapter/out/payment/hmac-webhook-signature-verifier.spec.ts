import { HmacWebhookSignatureVerifier } from './hmac-webhook-signature-verifier';
import { signWebhook } from './webhook-signature';

describe('HmacWebhookSignatureVerifier', () => {
  const secret = 'whsec';
  const body = JSON.stringify({ providerRef: 'r1', amountVnd: 1000, status: 'settled' });
  const verifier = new HmacWebhookSignatureVerifier(secret);

  it('accepts a signature produced with the configured secret', () => {
    expect(verifier.verify(body, signWebhook(body, secret))).toBe(true);
  });

  it('rejects a signature produced with a different secret', () => {
    expect(verifier.verify(body, signWebhook(body, 'other'))).toBe(false);
  });
});
