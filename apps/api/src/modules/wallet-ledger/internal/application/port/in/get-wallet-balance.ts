import type { WalletBalanceView } from '@skillswap/contracts';

export const GET_WALLET_BALANCE = Symbol('GetWalletBalance');

export interface GetWalletBalancePort {
  execute(ownerId: string): Promise<WalletBalanceView>;
}
