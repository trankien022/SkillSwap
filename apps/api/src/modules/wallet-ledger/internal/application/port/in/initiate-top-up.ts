import type { TopUpIntentView } from '@skillswap/contracts';

export const INITIATE_TOP_UP = Symbol('InitiateTopUp');

export interface InitiateTopUpInput {
  readonly ownerId: string;
  readonly amountVnd: number;
}

export interface InitiateTopUpPort {
  execute(input: InitiateTopUpInput): Promise<TopUpIntentView>;
}
