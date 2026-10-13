import type {
  InitiatePaymentRequest,
  InitiatePaymentResult,
  PaymentGateway,
} from '../../src/modules/wallet-ledger/internal/application/port/out/payment-gateway';

/**
 * Deterministic stand-in for the SePay checkout redirect, used only by the e2e
 * harness. Nothing under `src/` imports this file.
 *
 * The real adapter resolves `paymentUrl` by POSTing the signed form to SePay and
 * reading the `Location` of its 302. That needs network egress plus a live
 * sandbox merchant, so on a CI runner without credentials the suite would fail
 * on SePay's `404` instead of on the behaviour under test.
 *
 * Only the outbound redirect is substituted. The spec still posts a real SePay
 * IPN, the running application still settles the wallet against real Postgres,
 * and the ledger effects still cross the real outbox and RabbitMQ.
 */
export class StubPaymentGateway implements PaymentGateway {
  readonly provider = 'sepay';

  /** Requests seen, so a spec can assert the invoice number it issued. */
  readonly requests: InitiatePaymentRequest[] = [];

  async initiateTopUp(request: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
    this.requests.push(request);
    return {
      paymentUrl: `https://pay-sandbox.sepay.vn/v1/checkout?order_invoice_number=${request.providerRef}`,
    };
  }
}
