import { randomUUID } from 'node:crypto';

/**
 * FR-008 / ADR-033: the invoice number handed to SePay as
 * `order_invoice_number`. It is our `provider_ref` and the only correlation
 * key the IPN carries, so it must be unique and opaque.
 *
 * Shape: `SS-<epoch-ms>-<6 hex>` — time-ordered (useful when reading logs or
 * reconciling exports) with enough randomness to rule out a collision between
 * two intents created in the same millisecond by different learners.
 */
export function generateInvoiceNumber(now: number = Date.now()): string {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 6);
  return `SS-${now}-${suffix.toUpperCase()}`;
}
