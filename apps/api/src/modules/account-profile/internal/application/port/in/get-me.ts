import type { MeResponse } from '@skillswap/contracts';

export const GET_ME = Symbol('GetMe');

export interface GetMePort {
  execute(accountId: string): Promise<MeResponse>;
}
