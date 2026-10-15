import {
  DEFAULT_PAGE_LIMIT,
  type AdminVerificationPage,
  type AdminVerificationQueryInput,
} from '@skillswap/contracts';
import type { VerificationRepository } from './port/out/verification-repository';
import type { ListAdminVerificationsPort } from './port/in/list-admin-verifications';
import { toVerificationView } from './verification-view';

/**
 * FR-015 / NFR-014: the Administrator's verification queue.
 *
 * A thin read: the repository does the filtering, the keyset page and the count in one
 * transaction, and this handler only applies the default limit and maps rows to the wire view
 * (the same `toVerificationView` every other verification read uses, so the owner view and the
 * admin queue cannot describe the same row differently).
 *
 * There is no ownership check here on purpose — authorization is the controller's
 * (`@Roles('admin')`), and duplicating it would suggest this port is safe to expose without it.
 */
export class ListAdminVerificationsQueryHandler implements ListAdminVerificationsPort {
  constructor(private readonly verifications: VerificationRepository) {}

  async execute(query: AdminVerificationQueryInput): Promise<AdminVerificationPage> {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const page = await this.verifications.listForAdmin({
      limit,
      cursor: query.cursor,
      status: query.status,
      q: query.q,
      sort: query.sort,
    });

    return {
      items: page.items.map(toVerificationView),
      page: { limit, nextCursor: page.nextCursor, total: page.total },
    };
  }
}
