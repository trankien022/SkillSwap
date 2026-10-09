import type { TokenResponse } from '@skillswap/contracts';

export const LOGIN = Symbol('Login');

export interface LoginInput {
  readonly email: string;
  readonly password: string;
}

export interface LoginPort {
  execute(input: LoginInput): Promise<TokenResponse>;
}
