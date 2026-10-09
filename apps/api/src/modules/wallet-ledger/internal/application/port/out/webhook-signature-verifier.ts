export const WEBHOOK_SIGNATURE_VERIFIER = Symbol('WebhookSignatureVerifier');

/** Verifies the authenticity of an inbound payment webhook (ADR-017). */
export interface WebhookSignatureVerifier {
  verify(rawBody: string, signature: string): boolean;
}
