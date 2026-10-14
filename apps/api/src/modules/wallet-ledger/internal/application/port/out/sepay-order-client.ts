export const SEPAY_ORDER_CLIENT = Symbol('SepayOrderClient');

/**
 * FR-008 / ADR-033 reconciliation: the provider-side view of one order.
 *
 * `status` is already normalised to this module's vocabulary. `null` means the
 * provider has no such order, which is a real answer (the checkout was never
 * completed, or the invoice number was never issued) and not an error.
 */
export interface SepayOrderStatus {
  readonly providerRef: string;
  readonly providerOrderId: string | null;
  readonly status: 'pending' | 'settled' | 'failed' | 'reversed';
  readonly paidAmountVnd: number | null;
  readonly paidAt: Date | null;
}

/**
 * Outbound port used only by reconciliation. Kept separate from
 * `PaymentGateway` because it answers a different question — the gateway
 * *creates* a checkout, this *queries* one — and because the shipped path must
 * not depend on it.
 */
export interface SepayOrderClient {
  findByInvoiceNumber(providerRef: string): Promise<SepayOrderStatus | null>;
}
