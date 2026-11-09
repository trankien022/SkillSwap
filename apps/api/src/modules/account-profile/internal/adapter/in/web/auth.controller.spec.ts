import { UnauthorizedException } from '@nestjs/common';
import type { MeResponse } from '@skillswap/contracts';
import { AuthController } from './auth.controller';
import type { GetMePort } from '../../../application/port/in/get-me';
import type { UpdateMePort } from '../../../application/port/in/update-me';

/**
 * FR-001/FR-017: `GET /api/auth/me` reads the trusted identity, so it must
 * reject the `anonymous` identity that the gateway guard admits in
 * AUTH_MODE=off. Passing 'anonymous' through to the use case previously reached
 * a uuid column and returned a 500 instead of a 401.
 */
describe('AuthController.me', () => {
  const account: MeResponse = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'user@example.com',
    displayName: 'User',
    role: 'user',
    status: 'active',
    studentVerification: null,
  };

  function build(execute: GetMePort['execute'], update: UpdateMePort['execute'] = jest.fn()) {
    return new AuthController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { execute },
      { execute: update },
    );
  }

  it('rejects an anonymous caller with 401 and never calls the use case', () => {
    const execute = jest.fn<Promise<MeResponse>, [string]>();
    const controller = build(execute);

    // `me()` throws synchronously: the guard runs before the promise is built.
    expect(() => controller.me({ headers: {} } as never)).toThrow(UnauthorizedException);
    expect(execute).not.toHaveBeenCalled();
  });

  it('reads the account for an authenticated caller', async () => {
    const execute = jest.fn<Promise<MeResponse>, [string]>().mockResolvedValue(account);
    const controller = build(execute);

    await expect(
      controller.me({ headers: {}, user: { id: account.id } } as never),
    ).resolves.toEqual(account);
    expect(execute).toHaveBeenCalledWith(account.id);
  });

  it('updates only the authenticated caller and rejects anonymous updates', async () => {
    const update = jest.fn<ReturnType<UpdateMePort['execute']>, Parameters<UpdateMePort['execute']>>().mockResolvedValue({ ...account, displayName: 'New Name' });
    const controller = build(jest.fn(), update);
    await expect(controller.updateMyProfile({ headers: {}, user: { id: account.id } } as never, { displayName: 'New Name' } as never))
      .resolves.toMatchObject({ displayName: 'New Name' });
    expect(update).toHaveBeenCalledWith(account.id, { displayName: 'New Name' });
    expect(() => controller.updateMyProfile({ headers: {} } as never, { displayName: 'New Name' } as never)).toThrow(UnauthorizedException);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
