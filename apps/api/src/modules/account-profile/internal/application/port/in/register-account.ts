import type { SelfRegistrationRole } from '../../../domain/account';
import type { TokenResponse } from '@skillswap/contracts';

export const REGISTER_ACCOUNT = Symbol('RegisterAccount');

export interface RegisterAccountInput {
  readonly email: string;
  readonly displayName: string;
  readonly password: string;
  /** FR-001 / ADR-029: only a self-registration role may be chosen here. */
  readonly role?: SelfRegistrationRole;
}

export interface RegisterAccountPort {
  execute(input: RegisterAccountInput): Promise<TokenResponse>;
}
