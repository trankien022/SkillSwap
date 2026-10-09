import { randomUUID } from 'node:crypto';
import type { WalletBalance, TopUpStatus } from '../../domain/wallet';
import { InsufficientBalanceError } from '../../domain/wallet';
import type {
  ApplyTopUpRequest,
  ReleaseIncomeRequest,
  ReleaseIncomeResult,
  SettleBookingRequest,
  SettleBookingResult,
  WalletRepository,
} from '../port/out/wallet-repository';
import type {
  NewTopUpIntent,
  TopUpIntent,
  TopUpIntentRepository,
} from '../port/out/top-up-intent-repository';
import type { InitiatePaymentRequest, InitiatePaymentResult, PaymentGateway } from '../port/out/payment-gateway';

export class FakeWalletRepository implements WalletRepository {
  readonly balances = new Map<string, number>();
  readonly pending = new Map<string, number>();
  readonly entries: Array<ApplyTopUpRequest & { direction: string }> = [];
  readonly settledBookings = new Set<string>();
  readonly releasedKeys = new Set<string>();

  async getBalance(ownerId: string): Promise<WalletBalance> {
    return {
      availableCredits: this.balances.get(ownerId) ?? 0,
      pendingCredits: this.pending.get(ownerId) ?? 0,
    };
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

  async settleBooking(request: SettleBookingRequest): Promise<SettleBookingResult> {
    if (this.settledBookings.has(request.bookingId)) {
      return { applied: false, teacherCredits: request.teacherCredits, platformFeeCredits: request.platformFeeCredits };
    }
    const available = this.balances.get(request.learnerId) ?? 0;
    if (available < request.priceCredits) {
      throw new InsufficientBalanceError(available, request.priceCredits);
    }
    this.balances.set(request.learnerId, available - request.priceCredits);
    this.pending.set(request.teacherId, (this.pending.get(request.teacherId) ?? 0) + request.teacherCredits);
    this.settledBookings.add(request.bookingId);
    return { applied: true, teacherCredits: request.teacherCredits, platformFeeCredits: request.platformFeeCredits };
  }

  async releaseIncome(request: ReleaseIncomeRequest): Promise<ReleaseIncomeResult> {
    const key = `${request.bookingId}:${request.releaseKey}`;
    if (this.releasedKeys.has(key)) {
      return { applied: false };
    }
    this.releasedKeys.add(key);
    this.pending.set(request.teacherId, (this.pending.get(request.teacherId) ?? 0) - request.amountCredits);
    this.balances.set(request.teacherId, (this.balances.get(request.teacherId) ?? 0) + request.amountCredits);
    return { applied: true };
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
