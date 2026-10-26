import type { RequestWithIdentity } from '../../../../../../shared/http/identity';
import { ROLES_KEY } from '../../../../../../shared/http/roles.decorator';
import type { LockAccountPort } from '../../../application/port/in/lock-account';
import { AccountLockController } from './account-lock.controller';

/**
 * FR-015 / OQ-015 / ADR-037: the Administrator's suspend / reactivate routes.
 *
 * Two properties are worth pinning here, because both would be invisible in a happy-path call:
 * the caller is the **actor** while the path parameter is the **subject** (ADR-035 — swapping them
 * would make the audit log attribute the lock to the person being locked), and the role gate
 * (AC-033). Both are asserted through what reaches the port and what the decorator writes, not
 * through the controller's own source.
 */
describe('AccountLockController', () => {
  const PATH_METADATA = 'path';
  const ADMIN = '8a1e0000-0000-4000-8000-0000000000a1';
  const SUBJECT = '8a1e0000-0000-4000-8000-0000000000b2';

  function request(): RequestWithIdentity {
    return { headers: {}, user: { id: ADMIN, role: 'admin' } };
  }

  function port(result: Awaited<ReturnType<LockAccountPort['execute']>>) {
    const calls: Parameters<LockAccountPort['execute']>[0][] = [];
    const fake: LockAccountPort = {
      execute: jest.fn(async (command) => {
        calls.push(command);
        return result;
      }),
    };
    return { fake, calls };
  }

  it('suspends with the reason and attributes the act to the caller, not the subject', async () => {
    const { fake, calls } = port({
      accountId: SUBJECT,
      status: 'suspended',
      changed: true,
      reason: 'Repeated payment fraud',
    });
    const controller = new AccountLockController(fake);

    await controller.suspend(SUBJECT, { reason: 'Repeated payment fraud' }, request());

    expect(calls[0]).toEqual({
      accountId: SUBJECT,
      status: 'suspended',
      reason: 'Repeated payment fraud',
      actorId: ADMIN,
    });
    expect(calls[0]?.actorId).not.toBe(calls[0]?.accountId);
  });

  it('reinstates with no reason', async () => {
    const { fake, calls } = port({
      accountId: SUBJECT,
      status: 'active',
      changed: true,
      reason: null,
    });
    const controller = new AccountLockController(fake);

    const result = await controller.reinstate(SUBJECT, request());

    expect(calls[0]).toEqual({
      accountId: SUBJECT,
      status: 'active',
      reason: null,
      actorId: ADMIN,
    });
    expect(result.status).toBe('active');
  });

  it('gates both routes to the admin role', () => {
    for (const handler of [
      AccountLockController.prototype.suspend,
      AccountLockController.prototype.reinstate,
    ]) {
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual(['admin']);
    }
  });

  it('serves the lock actions under /operations/accounts', () => {
    expect(Reflect.getMetadata(PATH_METADATA, AccountLockController)).toBe('operations/accounts');
    expect(Reflect.getMetadata(PATH_METADATA, AccountLockController.prototype.suspend)).toBe(
      ':accountId/suspension',
    );
    expect(Reflect.getMetadata(PATH_METADATA, AccountLockController.prototype.reinstate)).toBe(
      ':accountId/reinstatement',
    );
  });
});
