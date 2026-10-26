import { SuspendedAccountsController } from './suspended-accounts.controller';
import type { SuspendedAccountsPage } from '@skillswap/contracts';
import type { ListSuspendedAccountsPort } from '../../../application/port/in/list-suspended-accounts';
import { ROLES_KEY } from '../../../../../../shared/http/roles.decorator';
import { encodeCursor } from '../../../../../../shared/http/keyset-cursor';

/**
 * FR-015 / ADR-037: the account-lock list.
 *
 * The role gate is the security property worth pinning (AC-033): the list names people an
 * Administrator has acted against, so a non-admin must not be able to read it. It is asserted
 * through the metadata `@Roles` writes, because a spec that only called `list()` would keep
 * passing if the decorator were removed.
 *
 * The cursor handling is pinned too: decoding lives in this adapter (ADR-009), so a test that only
 * checked the port's arguments would not notice a cursor leaking out unencoded.
 */
describe('SuspendedAccountsController', () => {
  const PATH_METADATA = 'path';
  const ACCOUNT = '7c1e0000-0000-4000-8000-0000000000b2';

  const page: SuspendedAccountsPage = {
    items: [
      {
        accountId: ACCOUNT,
        email: 'minh@skillswap.test',
        displayName: 'Minh',
        role: 'user',
        reason: 'Repeated payment fraud',
        suspendedBy: '7c1e0000-0000-4000-8000-0000000000a1',
        suspendedAt: '2026-10-26T09:00:00.000Z',
      },
    ],
    page: { limit: 20, total: 1, nextCursor: null },
  };

  function port(result: unknown): ListSuspendedAccountsPort & { execute: jest.Mock } {
    return { execute: jest.fn().mockResolvedValue(result) };
  }

  it('passes the query through to the port', async () => {
    const fake = port(page);
    const controller = new SuspendedAccountsController(fake);

    await expect(controller.list({ limit: 20, status: 'suspended' })).resolves.toEqual(page);
    expect(fake.execute).toHaveBeenCalledWith({
      limit: 20,
      status: 'suspended',
      cursor: undefined,
    });
  });

  it('decodes an incoming cursor before the port sees it (ADR-009)', async () => {
    const fake = port(page);
    const controller = new SuspendedAccountsController(fake);
    const cursor = encodeCursor(['1790000000000', ACCOUNT]);

    await controller.list({ limit: 5, cursor });

    expect(fake.execute).toHaveBeenCalledWith({
      limit: 5,
      status: undefined,
      cursor: ['1790000000000', ACCOUNT],
    });
  });

  it('does not fail the request on a malformed cursor', async () => {
    const fake = port(page);
    const controller = new SuspendedAccountsController(fake);

    await expect(controller.list({ limit: 5, cursor: '!!not-base64' })).resolves.toEqual(page);
    // `decodeCursor` hands back a single junk part rather than throwing; the handler's
    // `toSuspendedCursor` treats anything that is not two non-empty parts as "first page".
    // Either way the read succeeds, which is the property that matters at the boundary.
    const [args] = fake.execute.mock.calls[0] as [{ cursor?: readonly string[] }];
    expect(args.cursor === undefined || args.cursor.length !== 2).toBe(true);
  });

  it('encodes the next-cursor parts the port returns', async () => {
    const fake = port({
      ...page,
      page: { ...page.page, nextCursor: ['1790000000000', ACCOUNT] },
    });
    const controller = new SuspendedAccountsController(fake);

    const result = await controller.list({ limit: 1 });

    expect(result.page.nextCursor).toBe(encodeCursor(['1790000000000', ACCOUNT]));
  });

  it('is gated to the admin role', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      SuspendedAccountsController.prototype.list,
    ) as unknown;
    expect(roles).toEqual(['admin']);
  });

  it('serves the lock list at GET /operations/accounts', () => {
    const controllerPath = Reflect.getMetadata(PATH_METADATA, SuspendedAccountsController) as string;
    const handlerPath = Reflect.getMetadata(
      PATH_METADATA,
      SuspendedAccountsController.prototype.list,
    ) as string;
    expect(controllerPath).toBe('operations/accounts');
    expect(handlerPath).toBe('/');
  });
});
