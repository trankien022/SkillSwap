import type { TopUpIntentCreated } from '@skillswap/contracts';

export const INITIATE_TOP_UP = Symbol('InitiateTopUp');

export interface InitiateTopUpInput {
  readonly ownerId: string;
  readonly amountVnd: number;
  /**
   * FR-008: where the payer's client should land after checkout. Optional —
   * omitted means the configured fallback. The use case validates it against
   * the allow-list, so an implementation may reject a foreign origin.
   */
  readonly returnUrl?: string | undefined;
}

export interface InitiateTopUpPort {
  execute(input: InitiateTopUpInput): Promise<TopUpIntentCreated>;
}
