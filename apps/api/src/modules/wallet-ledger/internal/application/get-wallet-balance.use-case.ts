import type { WalletBalanceView } from '@skillswap/contracts';
import type { WalletRepository } from './port/out/wallet-repository';
import type { GetWalletBalancePort } from './port/in/get-wallet-balance';

/** FR-008 / FR-010: read the owner's current wallet balance. */
export class GetWalletBalanceUseCase implements GetWalletBalancePort {
  constructor(private readonly wallets: WalletRepository) {}

  async execute(ownerId: string): Promise<WalletBalanceView> {
    const balance = await this.wallets.getBalance(ownerId);
    return { availableCredits: balance.availableCredits, pendingCredits: balance.pendingCredits };
  }
}
