import type { ApiConfig } from '../../../../../../shared/config/api-config';
import type {
  InitiatePaymentRequest,
  InitiatePaymentResult,
  PaymentGateway,
} from '../../../application/port/out/payment-gateway';
import { signSepayFields } from './sepay-signature';

/**
 * FR-008 / ADR-033: the SePay Payment Gateway adapter.
 *
 * SePay has no "create payment" API — `POST {host}/v1/checkout/init` is a form
 * submission that answers `302` to the hosted checkout page. Design B: we POST
 * the signed form ourselves, do **not** follow the redirect, and hand the
 * `Location` back as the `paymentUrl`. The client therefore just opens a link,
 * exactly as it did with the mock, and the `PaymentGateway` port is unchanged.
 *
 * Sandbox and production differ only by the three configured URLs, so there is
 * no environment branching here.
 */
export class SepayPaymentGateway implements PaymentGateway {
  readonly provider = 'sepay';

  constructor(private readonly config: ApiConfig) {}

  async initiateTopUp(request: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
    const { checkoutUrl, fields } = this.buildCheckoutForm(request);
    const response = await fetch(checkoutUrl, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    });

    const hosted = response.headers.get('location');
    if (!hosted) {
      // No redirect means the request was rejected (bad signature, inactive
      // gateway, provider outage). Fail loudly so the intent is not left
      // pointing at a payment page that does not exist.
      const detail = await response.text().catch(() => '');
      throw new Error(
        `SePay checkout init failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 300)}` : ''}`,
      );
    }
    return { paymentUrl: hosted };
  }

  /**
   * The signed checkout form. `payment_method` is deliberately omitted so the
   * payer picks on SePay's page rather than being forced into one channel.
   * `order_amount` is integer VND — SePay takes the smallest currency unit.
   */
  private buildCheckoutForm(request: InitiatePaymentRequest): {
    checkoutUrl: string;
    fields: Record<string, string>;
  } {
    const returnUrl = this.config.sepayReturnUrl;
    const fields: Record<string, string> = {
      merchant: this.config.sepayMerchantId,
      operation: 'PURCHASE',
      order_amount: String(request.amountVnd),
      currency: 'VND',
      order_invoice_number: request.providerRef,
      order_description: request.description,
      success_url: returnUrl,
      error_url: returnUrl,
      cancel_url: returnUrl,
    };
    fields.signature = signSepayFields(fields, this.config.sepaySecretKey);
    return {
      checkoutUrl: `${this.config.sepayCheckoutHost.replace(/\/$/, '')}/v1/checkout/init`,
      fields,
    };
  }
}
