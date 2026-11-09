import type { MeResponse, UpdateMeRequest } from '@skillswap/contracts';

export const UPDATE_ME = Symbol('UpdateMe');

export interface UpdateMePort {
  execute(accountId: string, input: UpdateMeRequest): Promise<MeResponse>;
}
