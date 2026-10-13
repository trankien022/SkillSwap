import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * FR-008 / ADR-030: the SePay Payment Gateway checkout-form signature.
 *
 * SePay signs the *form fields themselves* (not a body) by joining them as
 * `key=value,key=value,...` in a fixed order and base64-encoding an HMAC-SHA256
 * of that string with the merchant's secret key. The redirect back from SePay
 * carries the same parameters plus its own `signature`, so verification is the
 * same computation over the same allow-listed fields.
 *
 * The field order is part of the contract: changing it invalidates every
 * signature. It mirrors the official SDK's insertion order.
 */
export const SEPAY_SIGNED_FIELDS = [
  'merchant',
  'env',
  'operation',
  'payment_method',
  'order_amount',
  'currency',
  'order_invoice_number',
  'order_description',
  'customer_id',
  'agreement_id',
  'agreement_name',
  'agreement_type',
  'agreement_payment_frequency',
  'agreement_amount_per_payment',
  'success_url',
  'error_url',
  'cancel_url',
  'order_id',
] as const;

export type SepayFieldName = (typeof SEPAY_SIGNED_FIELDS)[number];

/** The signed string SePay expects: allow-listed keys present, in fixed order. */
export function buildSepaySigningString(fields: Record<string, string | number>): string {
  return SEPAY_SIGNED_FIELDS.filter(
    (name) => fields[name] !== undefined && fields[name] !== '',
  )
    .map((name) => `${name}=${String(fields[name])}`)
    .join(',');
}

/** `base64(hmac_sha256(signingString, secretKey))`. */
export function signSepayFields(
  fields: Record<string, string | number>,
  secretKey: string,
): string {
  return createHmac('sha256', secretKey).update(buildSepaySigningString(fields)).digest('base64');
}

/** Constant-time comparison of a presented signature against the expected one. */
export function verifySepayFields(
  fields: Record<string, string | number>,
  presentedSignature: string,
  secretKey: string,
): boolean {
  const expected = Buffer.from(signSepayFields(fields, secretKey), 'utf8');
  const presented = Buffer.from(presentedSignature, 'utf8');
  if (expected.length !== presented.length) {
    return false;
  }
  return timingSafeEqual(expected, presented);
}
