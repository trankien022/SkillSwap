import { randomUUID } from 'node:crypto';
import type { TopUpIntentView } from '@skillswap/contracts';
import { vndToCredits } from '../domain/wallet';
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
    const providerRef = randomUUID();
    const payment = await this.gateway.initiateTopUp({
      providerRef,
      amountVnd: input.amountVnd,
      description: 'SkillSwap wallet top-up',
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
