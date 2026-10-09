import type { AccountRole } from '../../../domain/account';
import type { TokenResponse } from '@skillswap/contracts';

export const REGISTER_ACCOUNT = Symbol('RegisterAccount');

export interface RegisterAccountInput {
  readonly email: string;
  readonly displayName: string;
  readonly password: string;
  readonly role?: AccountRole;
}

export interface RegisterAccountPort {
  execute(input: RegisterAccountInput): Promise<TokenResponse>;
}
