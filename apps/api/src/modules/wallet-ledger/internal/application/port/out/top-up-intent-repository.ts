import type { TopUpStatus } from '../../../domain/wallet';

export const TOP_UP_INTENT_REPOSITORY = Symbol('TopUpIntentRepository');

export interface TopUpIntent {
  readonly id: string;
  readonly ownerId: string;
  readonly provider: string;
  readonly providerRef: string;
  readonly amountVnd: number;
  readonly amountCredits: number;
  readonly status: TopUpStatus;
}

export interface NewTopUpIntent {
  readonly ownerId: string;
  readonly provider: string;
  readonly providerRef: string;
  readonly amountVnd: number;
  readonly amountCredits: number;
}

export interface TopUpIntentRepository {
  create(input: NewTopUpIntent): Promise<TopUpIntent>;
  findByProviderRef(provider: string, providerRef: string): Promise<TopUpIntent | null>;
  updateStatus(id: string, status: TopUpStatus): Promise<void>;
}
