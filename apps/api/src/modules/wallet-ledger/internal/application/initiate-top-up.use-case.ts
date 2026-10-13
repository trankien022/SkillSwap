import type { TopUpIntentView } from '@skillswap/contracts';
import { vndToCredits } from '../domain/wallet';
import { generateInvoiceNumber } from '../domain/invoice-number';
import type { PaymentGateway } from './port/out/payment-gateway';
import type { TopUpIntentRepository } from './port/out/top-up-intent-repository';
import type { InitiateTopUpInput, InitiateTopUpPort } from './port/in/initiate-top-up';

/** FR-008 / API-006: open a top-up intent and return provider payment details. */
export class InitiateTopUpUseCase implements InitiateTopUpPort {
  constructor(
    private readonly intents: TopUpIntentRepository,
    private readonly gateway: PaymentGateway,
  ) {}

  async execute(input: InitiateTopUpInput): Promise<TopUpIntentView> {
    const amountCredits = vndToCredits(input.amountVnd);
    // ADR-033: the invoice number is the `provider_ref` and the IPN's only
    // correlation key, so it is generated here rather than by the adapter.
    const providerRef = generateInvoiceNumber();
    const payment = await this.gateway.initiateTopUp({
      providerRef,
      amountVnd: input.amountVnd,
      description: `SkillSwap wallet top-up ${providerRef}`,
    });
    const intent = await this.intents.create({
      ownerId: input.ownerId,
      provider: this.gateway.provider,
      providerRef,
      amountVnd: input.amountVnd,
      amountCredits,
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
    };
  }
}
