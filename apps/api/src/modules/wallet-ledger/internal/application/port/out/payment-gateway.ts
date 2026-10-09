export const PAYMENT_GATEWAY = Symbol('PaymentGateway');

export interface InitiatePaymentRequest {
  readonly providerRef: string;
  readonly amountVnd: number;
  readonly description: string;
}

export interface InitiatePaymentResult {
  readonly paymentUrl: string;
}

/**
 * Outbound port for the payment provider. The MVP ships a mock adapter
 * (ADR-017); a real vendor swaps this adapter only.
 */
export interface PaymentGateway {
  readonly provider: string;
  initiateTopUp(request: InitiatePaymentRequest): Promise<InitiatePaymentResult>;
}
