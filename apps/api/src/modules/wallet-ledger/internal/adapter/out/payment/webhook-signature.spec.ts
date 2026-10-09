import { signWebhook, verifyWebhookSignature } from './webhook-signature';

describe('webhook signature', () => {
  const secret = 'test-secret';
  const body = JSON.stringify({ providerRef: 'r1', amountVnd: 1000, status: 'settled' });

  it('verifies a signature produced with the same secret', () => {
    const signature = signWebhook(body, secret);
    expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
  });

  it('rejects a wrong secret, a tampered body, and an empty signature', () => {
    const signature = signWebhook(body, secret);
    expect(verifyWebhookSignature(body, signature, 'other')).toBe(false);
    expect(verifyWebhookSignature(`${body} `, signature, secret)).toBe(false);
    expect(verifyWebhookSignature(body, '', secret)).toBe(false);
  });
});
