import type { WebhookSignatureVerifier } from '../../../application/port/out/webhook-signature-verifier';
import { verifyWebhookSignature } from './webhook-signature';

/** HMAC-SHA256 webhook verification, bound to the configured secret (ADR-017). */
export class HmacWebhookSignatureVerifier implements WebhookSignatureVerifier {
  constructor(private readonly secret: string) {}

  verify(rawBody: string, signature: string): boolean {
    return verifyWebhookSignature(rawBody, signature, this.secret);
  }
}
