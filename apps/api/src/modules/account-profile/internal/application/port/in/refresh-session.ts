import type { TokenResponse } from '@skillswap/contracts';

export const REFRESH_SESSION = Symbol('RefreshSession');

export interface RefreshSessionInput {
  readonly refreshToken: string;
}

export interface RefreshSessionPort {
  execute(input: RefreshSessionInput): Promise<TokenResponse>;
}
