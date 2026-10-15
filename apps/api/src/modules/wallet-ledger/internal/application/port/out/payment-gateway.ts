export const PAYMENT_GATEWAY = Symbol('PaymentGateway');

export interface InitiatePaymentRequest {
  readonly providerRef: string;
  readonly amountVnd: number;
  readonly description: string;
  /**
   * FR-008: where the provider sends the payer back. Already resolved against
   * the configured allow-list by the calling use case, so the adapter only
   * places it in the checkout form.
   */
  readonly returnUrl: string;
}

export interface InitiatePaymentResult {
  readonly paymentUrl: string;
}

/**
 * Outbound port for the payment provider. The adapter behind it is the SePay
 * Payment Gateway (ADR-033); Sandbox and Production differ only by
 * configuration, and a further vendor swap replaces this adapter alone.
 */
export interface PaymentGateway {
  readonly provider: string;
  initiateTopUp(request: InitiatePaymentRequest): Promise<InitiatePaymentResult>;
}
