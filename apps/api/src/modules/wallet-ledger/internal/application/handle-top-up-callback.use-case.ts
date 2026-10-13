import { randomUUID } from 'node:crypto';
import { canAdvanceTopUp, type TopUpStatus } from '../domain/wallet';
import type { WalletRepository } from './port/out/wallet-repository';
import type { TopUpIntentRepository } from './port/out/top-up-intent-repository';
import type {
  HandleTopUpCallbackInput,
  HandleTopUpCallbackPort,
  HandleTopUpCallbackResult,
} from './port/in/handle-top-up-callback';

/**
 * FR-008 / AC-009 (ADR-030): applies a payment callback exactly once and only
 * when it moves the intent forward. A settled callback credits the wallet with
 * its ledger entry in one transaction; a reversal posts an offsetting debit.
 *
 * SePay retries IPNs, so idempotency is not optional: `canAdvanceTopUp` makes a
 * replay of a terminal transition a no-op, and a caller that has already
 * recognised the callback as a duplicate never reaches the credit path.
 */
export class HandleTopUpCallbackUseCase implements HandleTopUpCallbackPort {
  constructor(
    private readonly intents: TopUpIntentRepository,
    private readonly wallets: WalletRepository,
    private readonly provider: string,
  ) {}

  async execute(input: HandleTopUpCallbackInput): Promise<HandleTopUpCallbackResult> {
    const intent = await this.intents.findByProviderRef(this.provider, input.providerRef);
    if (intent === null) {
      // Unknown reference: acknowledge without side effects (idempotent no-op).
      return { applied: false, status: 'unknown' };
    }

    const next = input.status as TopUpStatus;
    if (!canAdvanceTopUp(intent.status, next)) {
      // Replay or out-of-order callback: acknowledge, do not apply (AC-009).
      return { applied: false, status: intent.status };
    }

    if (next === 'settled') {
      await this.wallets.applyTopUp({
        ownerId: intent.ownerId,
        intentId: intent.id,
        amountCredits: intent.amountCredits,
        direction: 'credit',
        traceId: randomUUID(),
      });
    } else if (next === 'reversed') {
      await this.wallets.applyTopUp({
        ownerId: intent.ownerId,
        intentId: intent.id,
        amountCredits: intent.amountCredits,
        direction: 'debit',
        traceId: randomUUID(),
      });
    }

    await this.intents.recordSettlement(intent.id, next, {
      providerOrderId: input.providerOrderId ?? null,
      paidAmountVnd: input.paidAmountVnd ?? null,
      paidAt: input.paidAt ?? null,
    });
    return { applied: true, status: next };
  }
}
