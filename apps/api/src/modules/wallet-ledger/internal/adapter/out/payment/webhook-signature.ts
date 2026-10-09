import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies a payment webhook signature (ADR-017): HMAC-SHA256 over the raw
 * request body, compared in constant time. A shared secret is configured via
 * env; an empty secret disables verification only in the mock/dev adapter.
 */
export function signWebhook(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = signWebhook(rawBody, secret);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
