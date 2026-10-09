import { randomUUID } from 'node:crypto';
import type { WalletBalance, TopUpStatus } from '../../domain/wallet';
import type { ApplyTopUpRequest, WalletRepository } from '../port/out/wallet-repository';
import type {
  NewTopUpIntent,
  TopUpIntent,
  TopUpIntentRepository,
} from '../port/out/top-up-intent-repository';
import type { InitiatePaymentRequest, InitiatePaymentResult, PaymentGateway } from '../port/out/payment-gateway';

export class FakeWalletRepository implements WalletRepository {
  readonly balances = new Map<string, number>();
  readonly entries: Array<ApplyTopUpRequest & { direction: string }> = [];

  async getBalance(ownerId: string): Promise<WalletBalance> {
    return { availableCredits: this.balances.get(ownerId) ?? 0, pendingCredits: 0 };
  }

  async addAvailable(ownerId: string, deltaCredits: number): Promise<WalletBalance> {
    this.balances.set(ownerId, (this.balances.get(ownerId) ?? 0) + deltaCredits);
    return this.getBalance(ownerId);
  }

  async applyTopUp(request: ApplyTopUpRequest): Promise<WalletBalance> {
    this.entries.push(request);
    const delta = request.direction === 'credit' ? request.amountCredits : -request.amountCredits;
    return this.addAvailable(request.ownerId, delta);
  }
}

export class FakeTopUpIntentRepository implements TopUpIntentRepository {
  readonly intents = new Map<string, TopUpIntent>();

  async create(input: NewTopUpIntent): Promise<TopUpIntent> {
    const intent: TopUpIntent = { id: randomUUID(), ...input, status: 'pending' };
    this.intents.set(intent.id, intent);
    return intent;
  }

  async findByProviderRef(provider: string, providerRef: string): Promise<TopUpIntent | null> {
    for (const intent of this.intents.values()) {
      if (intent.provider === provider && intent.providerRef === providerRef) return intent;
    }
    return null;
  }

  async updateStatus(id: string, status: TopUpStatus): Promise<void> {
    const intent = this.intents.get(id);
    if (intent !== undefined) this.intents.set(id, { ...intent, status });
  }
}

export class FakePaymentGateway implements PaymentGateway {
  readonly provider = 'mock';

  async initiateTopUp(request: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
    return { paymentUrl: `https://mock.pay.local/checkout?ref=${request.providerRef}` };
  }
}
