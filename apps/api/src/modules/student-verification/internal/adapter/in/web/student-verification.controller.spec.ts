import { StudentVerificationController } from './student-verification.controller';
import type { AdminVerificationPage, StudentVerificationView } from '@skillswap/contracts';
import type { GetMyVerificationPort } from '../../../application/port/in/get-my-verification';
import type { ListAdminVerificationsPort } from '../../../application/port/in/list-admin-verifications';

describe('StudentVerificationController nullable status transport', () => {
  const resource: StudentVerificationView = {
    id: 'verification-1', status: 'pending', schoolName: 'Test school', major: null,
    reviewerId: null, reason: null, decidedAt: null, submittedAt: '2026-10-12T00:00:00.000Z',
  };
  it.each([null, resource])('returns the nullable resource and binds caller ownership', async (verification) => {
    const getMine: GetMyVerificationPort = { execute: jest.fn().mockResolvedValue(verification) };
    const unused = { execute: jest.fn() };
    const controller = new StudentVerificationController(unused, unused, unused, unused, getMine, unused);
    await expect(controller.mine({ headers: {}, user: { id: 'caller-1', role: 'user' } })).resolves.toEqual(verification);
    expect(getMine.execute).toHaveBeenCalledWith('caller-1');
  });
});

describe('StudentVerificationController admin queue', () => {
  const page: AdminVerificationPage = {
    items: [
      {
        id: 'verification-1', status: 'pending', schoolName: 'Test school', major: null,
        reviewerId: null, reason: null, decidedAt: null, submittedAt: '2026-10-12T00:00:00.000Z',
      },
    ],
    page: { limit: 20, nextCursor: null, total: 1 },
  };

  it('delegates the query to the admin list port', async () => {
    const listAdmin: ListAdminVerificationsPort = {
      execute: jest.fn().mockResolvedValue(page),
    };
    const unused = { execute: jest.fn() };
    const controller = new StudentVerificationController(
      unused, unused, unused, unused, unused, listAdmin,
    );

    const query = { limit: 20, status: 'pending' as const };
    await expect(controller.listVerifications(query)).resolves.toEqual(page);
    expect(listAdmin.execute).toHaveBeenCalledWith(query);
  });

  /**
   * The plan's route-order hazard: Nest matches paths in declaration order, so a bare `@Get()`
   * declared before `@Get('me')` would swallow the caller's own read and route
   * `GET /student-verifications/me` into the admin queue (which would then 403 every learner).
   *
   * This reads the real path metadata Nest uses (`path`) off the prototype and asserts `me` comes
   * first, so the guard fails if either handler moves or the paths change.
   */
  it('declares the caller-scoped read before the bare admin route', () => {
    // Nest stores `@Get('me')` as PATH_METADATA on the method function itself.
    const PATH_METADATA = 'path';
    const getPath = (handler: unknown): string | undefined =>
      Reflect.getMetadata(PATH_METADATA, handler as object) as string | undefined;

    expect(getPath(StudentVerificationController.prototype.mine)).toBe('me');
    expect(getPath(StudentVerificationController.prototype.listVerifications)).toBe('/');

    // Declaration order in the class body: `mine` must precede `listVerifications`, because Nest
    // matches the routing table in the order the methods appear.
    const declarationOrder = Object.getOwnPropertyNames(StudentVerificationController.prototype);
    expect(declarationOrder.indexOf('mine')).toBeGreaterThan(-1);
    expect(declarationOrder.indexOf('mine')).toBeLessThan(
      declarationOrder.indexOf('listVerifications'),
    );
  });
});
