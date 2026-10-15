import { VerifierController } from './verifier.controller';
import { AdminVerifierQueueQueryDto } from './dto/skill-verification.dto';
import type { AdminVerifierQueuePage, VerifierQueuePage } from '@skillswap/contracts';
import type { ListVerifierQueuePort } from '../../../application/port/in/list-verifier-queue';
import type { ListAdminVerifierQueuePort } from '../../../application/port/in/list-admin-verifier-queue';

/**
 * FR-015: the admin Verifier queue lives on the same controller as the Verifier's own queue.
 *
 * The two routes (`me/queue` and `admin/queue`) are distinguishable, but Nest matches by
 * declaration order, so a careless reorder could still route a Verifier's request into the admin
 * read (which would then 403 every Verifier). These pin both the path metadata and the order.
 */
describe('VerifierController queue routing', () => {
  const unused = { execute: jest.fn() } as never;

  it('delegates the admin queue to the admin port and binds no caller', async () => {
    const page: AdminVerifierQueuePage = { items: [], page: { limit: 20, nextCursor: null, total: 0 } };
    const adminQueue: ListAdminVerifierQueuePort = { execute: jest.fn().mockResolvedValue(page) };
    const controller = new VerifierController(unused, unused, adminQueue);

    // The wire carries `status=pending,claimed`; the schema turns it into a list before the
    // handler sees it. Passing the unparsed string here would test a shape no request produces.
    const query = AdminVerifierQueueQueryDto.schema.parse({ domain: 'Programming', status: 'pending' });
    await expect(controller.listAdminQueue(query)).resolves.toEqual(page);
    expect(adminQueue.execute).toHaveBeenCalledWith({ domain: 'Programming', status: ['pending'] });
  });

  it('delegates the caller queue to the verifier port with the caller id', async () => {
    const page: VerifierQueuePage = { items: [], page: { limit: 20, nextCursor: null, total: 0 } };
    const queue: ListVerifierQueuePort = { execute: jest.fn().mockResolvedValue(page) };
    const controller = new VerifierController(unused, queue, unused);

    await controller.myQueue(
      { limit: 5 } as never,
      { headers: {}, user: { id: 'vf-1', role: 'verifier' } },
    );

    expect(queue.execute).toHaveBeenCalledWith(expect.objectContaining({ verifierId: 'vf-1' }));
  });

  it('declares me/queue before admin/queue so a Verifier is never routed into the admin read', () => {
    const PATH_METADATA = 'path';
    const getPath = (handler: unknown): string | undefined =>
      Reflect.getMetadata(PATH_METADATA, handler as object) as string | undefined;

    expect(getPath(VerifierController.prototype.myQueue)).toBe('me/queue');
    expect(getPath(VerifierController.prototype.listAdminQueue)).toBe('admin/queue');

    const order = Object.getOwnPropertyNames(VerifierController.prototype);
    expect(order.indexOf('myQueue')).toBeGreaterThan(-1);
    expect(order.indexOf('myQueue')).toBeLessThan(order.indexOf('listAdminQueue'));
  });
});
