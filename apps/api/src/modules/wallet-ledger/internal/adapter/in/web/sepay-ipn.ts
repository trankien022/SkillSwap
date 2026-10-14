import type { SepayIpn } from '@skillswap/contracts';
import type { HandleTopUpCallbackInput } from '../../../application/port/in/handle-top-up-callback';

/**
 * FR-008 / ADR-033: translates a SePay IPN into the application's normalised
 * callback shape. It lives with the inbound adapter because the provider's wire
 * format is an HTTP concern, not a domain rule.
 *
 * Two divergences from SePay's docs are handled here, both observed on real
 * Sandbox deliveries (plan §5a):
 *  - a successful payment arrives as `ORDER_PAID` **or** `PAYMENT_SUCCESS`;
 *  - `order_amount` / `transaction_amount` are strings in one delivery and
 *    numbers in another, and may carry a fractional part (`"10000.00"`).
 */
const SETTLED_NOTIFICATIONS = new Set(['ORDER_PAID', 'PAYMENT_SUCCESS']);
const REVERSED_NOTIFICATIONS = new Set(['TRANSACTION_VOID']);

/**
 * Maps a recognised IPN onto a callback input. Returns `null` for a
 * notification type this adapter does not act on, so the controller can
 * acknowledge (HTTP 200) without side effects — SePay must not be told to
 * retry something we will never apply.
 */
export function toCallbackInput(ipn: SepayIpn): HandleTopUpCallbackInput | null {
  const settled = SETTLED_NOTIFICATIONS.has(ipn.notification_type);
  const reversed = REVERSED_NOTIFICATIONS.has(ipn.notification_type);
  if (!settled && !reversed) {
    return null;
  }

  const transactionDate = ipn.transaction?.transaction_date;

  return {
    providerRef: ipn.order.order_invoice_number,
    amountVnd: parseSepayAmount(ipn.order.order_amount) ?? 0,
    status: settled ? 'settled' : 'reversed',
    providerOrderId: ipn.order.order_id ?? null,
    paidAmountVnd: settled ? parseSepayAmount(ipn.transaction?.transaction_amount) : null,
    paidAt: transactionDate === undefined ? null : parseSepayDate(transactionDate),
  };
}

/** Parses a SePay money field (`"10000.00"` or `10000`) into integer VND. */
export function parseSepayAmount(value: string | number | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round(parsed);
}

/**
 * SePay reports `transaction_date` as `"YYYY-MM-DD HH:mm:ss"` in its own
 * timezone (UTC+7, no offset in the string). Anchoring it to +07:00 yields the
 * correct instant; an unparseable value falls back to null rather than a
 * silently wrong timestamp.
 */
export function parseSepayDate(value: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(value);
  if (match === null) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(`${match[1]}T${match[2]}+07:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
