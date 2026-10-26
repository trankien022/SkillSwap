import type { TopUpIntentCreated } from '@skillswap/contracts';
import { VND_PER_CREDIT, vndToCredits } from '../domain/wallet';
import { generateInvoiceNumber } from '../domain/invoice-number';
import { resolveReturnUrl, withProviderRef } from '../domain/return-url';
import type { PaymentGateway } from './port/out/payment-gateway';
import type { TopUpIntentRepository } from './port/out/top-up-intent-repository';
import type { InitiateTopUpInput, InitiateTopUpPort } from './port/in/initiate-top-up';

/** FR-008 / API-006: open a top-up intent and return provider payment details. */
export class InitiateTopUpUseCase implements InitiateTopUpPort {
  constructor(
    private readonly intents: TopUpIntentRepository,
    private readonly gateway: PaymentGateway,
    /**
     * `SEPAY_RETURN_URL` — the configured fallback *and* the base of the
     * allow-list. Injected as a value so the use case stays free of config
     * access.
     */
    private readonly configuredReturnUrl: string,
    /**
     * Additional browser origins the payer's own client may run on (the
     * configured origin is always allowed). Same reason it is a value.
     */
    private readonly allowedOrigins: readonly string[] = [],
    /**
     * BR-027 / D3: VND per credit, from `ApiConfig.vndPerCredit`. Passed as a value for the same
     * reason as the return URL — the use case stays free of config access, and a test can price
     * at a different rate without touching a global.
     */
    private readonly vndPerCredit: number = VND_PER_CREDIT,
  ) {}

  async execute(input: InitiateTopUpInput): Promise<TopUpIntentCreated> {
    // The rate is resolved once and travels with the intent, so the credits the payer is told
    // about at checkout are the credits the ledger will hold no matter when the IPN arrives.
    const amountCredits = vndToCredits(input.amountVnd, this.vndPerCredit);
    // ADR-033: the invoice number is the `provider_ref` and the IPN's only
    // correlation key, so it is generated here rather than by the adapter.
    const providerRef = generateInvoiceNumber();
    // Resolve before opening the intent: a refused URL must not leave a
    // pending intent behind that the payer can never complete.
    //
    // The invoice number travels back on the URL SePay redirects to, because
    // SePay's redirect is the only thing the payer's browser gets and the id
    // does not exist yet at this point. The invoice number is already the IPN's
    // correlation key, so the return page can look the intent up by exactly the
    // same handle the provider uses. `withProviderRef` refuses to do this for a
    // custom scheme, which cannot carry a query.
    const returnUrl = withProviderRef(
      resolveReturnUrl(input.returnUrl, this.configuredReturnUrl, this.allowedOrigins),
      providerRef,
    );
    const payment = await this.gateway.initiateTopUp({
      providerRef,
      amountVnd: input.amountVnd,
      description: `SkillSwap wallet top-up ${providerRef}`,
      returnUrl,
    });
    const intent = await this.intents.create({
      ownerId: input.ownerId,
      provider: this.gateway.provider,
      providerRef,
      amountVnd: input.amountVnd,
      amountCredits,
      vndPerCredit: this.vndPerCredit,
    });
    return {
      id: intent.id,
      ownerId: intent.ownerId,
      provider: intent.provider,
      providerRef: intent.providerRef,
      amountVnd: intent.amountVnd,
      amountCredits: intent.amountCredits,
      status: intent.status,
      paymentUrl: payment.paymentUrl,
    };  }
}
