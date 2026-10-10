import { randomUUID } from 'node:crypto';
import type { ReleaseIncomeInput, ReleaseIncomePort, ReleaseIncomeResult } from './port/in/release-income';
import type { WalletRepository } from './port/out/wallet-repository';

/**
 * FR-009 / OQ-006 (ADR-018): releases a Teacher's pending income to available
 * when the class completes. Idempotent per (booking, releaseKey) — AC-015.
 */
export class ReleaseIncomeUseCase implements ReleaseIncomePort {
  constructor(private readonly wallets: WalletRepository) {}

  async execute(input: ReleaseIncomeInput): Promise<ReleaseIncomeResult> {
    return this.wallets.releaseIncome({
      bookingId: input.bookingId,
      teacherId: input.teacherId,
      amountCredits: input.amountCredits,
      releaseKey: input.releaseKey,
      traceId: randomUUID(),
    });
  }
}
