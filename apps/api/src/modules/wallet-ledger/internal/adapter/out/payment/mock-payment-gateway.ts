import type {
  InitiatePaymentRequest,
  InitiatePaymentResult,
  PaymentGateway,
} from '../../../application/port/out/payment-gateway';

/**
 * Development payment gateway (ADR-017). It returns a local redirect URL and
 * performs no network calls; a real provider swaps this adapter behind the
 * same port without touching the application layer.
 */
export class MockPaymentGateway implements PaymentGateway {
  readonly provider = 'mock';

  constructor(private readonly checkoutBaseUrl: string = 'https://mock.pay.skillswap.local/checkout') {}

  async initiateTopUp(request: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
    const url = new URL(this.checkoutBaseUrl);
    url.searchParams.set('ref', request.providerRef);
    url.searchParams.set('amount', String(request.amountVnd));
    return { paymentUrl: url.toString() };
  }
}
