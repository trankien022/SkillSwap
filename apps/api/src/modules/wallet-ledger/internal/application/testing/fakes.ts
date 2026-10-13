import { randomUUID } from 'node:crypto';
import type { WalletBalance, TopUpStatus } from '../../domain/wallet';
import { InsufficientBalanceError } from '../../domain/wallet';
import type {
  ApplyTopUpRequest,
  RefundBookingRequest,
  RefundBookingResult,
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
  TopUpSettlement,
} from '../port/out/top-up-intent-repository';
import type { InitiatePaymentRequest, InitiatePaymentResult, PaymentGateway } from '../port/out/payment-gateway';
import type { SepayOrderClient, SepayOrderStatus } from '../port/out/sepay-order-client';
import type { HistoryQuery, WalletReader } from '../port/out/wallet-reader';
import type { WalletHistoryItemView, WalletHistoryPage } from '@skillswap/contracts';

export class FakeWalletRepository implements WalletRepository {
  readonly balances = new Map<string, number>();
  readonly pending = new Map<string, number>();
  readonly entries: Array<ApplyTopUpRequest & { direction: string }> = [];
  readonly settledBookings = new Set<string>();
  readonly releasedKeys = new Set<string>();
  readonly refundedBookings = new Set<string>();

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

  async refundBooking(request: RefundBookingRequest): Promise<RefundBookingResult> {
    if (!this.settledBookings.has(request.bookingId) || this.refundedBookings.has(request.bookingId)) {
      return { applied: false };
    }
    this.refundedBookings.add(request.bookingId);
    // Mirror splitSettlement: floor fee, remainder to the teacher.
    const teacherShare = request.priceCredits - Math.floor((request.priceCredits * 1000) / 10_000);
    this.balances.set(request.learnerId, (this.balances.get(request.learnerId) ?? 0) + request.priceCredits);
    this.pending.set(
      request.teacherId,
      Math.max(0, (this.pending.get(request.teacherId) ?? 0) - teacherShare),
    );
    return { applied: true };
  }
}

export class FakeTopUpIntentRepository implements TopUpIntentRepository {
  readonly intents = new Map<string, TopUpIntent>();

  async create(input: NewTopUpIntent): Promise<TopUpIntent> {
    const intent: TopUpIntent = {
      id: randomUUID(),
      ...input,
      providerOrderId: null,
      paidAmountVnd: null,
      paidAt: null,
      status: 'pending',
    };
    this.intents.set(intent.id, intent);
    return intent;
  }

  async findByProviderRef(provider: string, providerRef: string): Promise<TopUpIntent | null> {
    for (const intent of this.intents.values()) {
      if (intent.provider === provider && intent.providerRef === providerRef) return intent;
    }
    return null;
  }

  async findById(id: string): Promise<TopUpIntent | null> {
    return this.intents.get(id) ?? null;
  }

  async updateStatus(id: string, status: TopUpStatus): Promise<void> {
    const intent = this.intents.get(id);
    if (intent !== undefined) this.intents.set(id, { ...intent, status });
  }

  async recordSettlement(
    id: string,
    status: TopUpStatus,
    settlement: TopUpSettlement,
  ): Promise<void> {
    const intent = this.intents.get(id);
    if (intent === undefined) return;
    this.intents.set(id, {
      ...intent,
      status,
      providerOrderId: settlement.providerOrderId ?? intent.providerOrderId,
      paidAmountVnd: settlement.paidAmountVnd ?? intent.paidAmountVnd,
      paidAt: settlement.paidAt ?? intent.paidAt,
    });
  }

  /**
   * FR-008 / ADR-033 reconciliation. Every fake intent starts at the current
   * instant, so a test that wants a sweepable row sets `ages` explicitly rather
   * than depending on wall-clock time.
   */
  readonly ages = new Map<string, number>();

  async findStalePending(olderThanMs: number, limit: number): Promise<TopUpIntent[]> {
    return [...this.intents.values()]
      .filter((intent) => intent.status === 'pending')
      .filter((intent) => (this.ages.get(intent.id) ?? 0) >= olderThanMs)
      .slice(0, limit);
  }
}

/** Test double for the reconciliation order lookup. No network is touched. */
export class FakeSepayOrderClient implements SepayOrderClient {
  private readonly orders = new Map<string, SepayOrderStatus>();

  set(order: SepayOrderStatus): void {
    this.orders.set(order.providerRef, order);
  }

  /** Invoice numbers looked up, so a test can assert the sweep's reach. */
  readonly queries: string[] = [];

  async findByInvoiceNumber(providerRef: string): Promise<SepayOrderStatus | null> {
    this.queries.push(providerRef);
    return this.orders.get(providerRef) ?? null;
  }
}

/**
 * Test double for the PaymentGateway port. It mirrors the real adapter's shape —
 * provider `sepay` and a hosted checkout URL — so a unit test cannot pass while
 * asserting against a URL the real gateway would never produce.
 */
export class FakePaymentGateway implements PaymentGateway {
  readonly provider = 'sepay';

  /** Requests seen, so tests can assert the invoice number the adapter was given. */
  readonly requests: InitiatePaymentRequest[] = [];

  async initiateTopUp(request: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
    this.requests.push(request);
    return {
      paymentUrl: `https://pay-sandbox.sepay.vn/v1/checkout?order_invoice_number=${request.providerRef}`,
    };
  }
}

/** In-memory wallet reader: entries are stored newest-first per owner. */
export class FakeWalletReader implements WalletReader {
  readonly entries = new Map<string, WalletHistoryItemView[]>();

  seed(ownerId: string, items: WalletHistoryItemView[]): void {
    this.entries.set(ownerId, items);
  }

  async history(query: HistoryQuery): Promise<WalletHistoryPage> {
    const all = this.entries.get(query.ownerId) ?? [];
    const start = query.cursor === undefined ? 0 : Number.parseInt(query.cursor, 10);
    const slice = all.slice(start, start + query.limit);
    const next = start + query.limit < all.length ? String(start + query.limit) : null;
    return { items: slice, page: { limit: query.limit, nextCursor: next, total: all.length } };
  }

  async sums(ownerId: string): Promise<{ credits: number; debits: number }> {
    const all = this.entries.get(ownerId) ?? [];
    return all.reduce(
      (acc, item) =>
        item.direction === 'credit'
          ? { ...acc, credits: acc.credits + item.amountCredits }
          : { ...acc, debits: acc.debits + item.amountCredits },
      { credits: 0, debits: 0 },
    );
  }
}
