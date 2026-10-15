import {
  DEFAULT_PAGE_LIMIT,
  type AdminVerifierQueuePage,
  type AdminVerifierQueueQueryInput,
} from '@skillswap/contracts';
import type { SkillEvidenceRepository } from './port/out/skill-evidence-repository';
import type { ListAdminVerifierQueuePort } from './port/in/list-admin-verifier-queue';
import { toSkillEvidenceView } from './skill-evidence-view';

/**
 * FR-015 / NFR-014: the Administrator's Verify queue, by domain.
 *
 * A thin read: the repository does the filtering, the keyset page and the count in one
 * transaction; this handler applies the default limit and maps rows through the same
 * `toSkillEvidenceView` the Verifier's own queue uses, so the two surfaces cannot describe the
 * same evidence differently.
 *
 * There is deliberately no verifier-existence check here. The Verifier queue rejects an unknown
 * or inactive Verifier because the read is *about* that caller; an administrator's queue is
 * about the work, so a suspended Verifier's abandoned claims must still be visible rather than
 * filtering the queue to nothing.
 */
export class ListAdminVerifierQueueQueryHandler implements ListAdminVerifierQueuePort {
  constructor(private readonly evidence: SkillEvidenceRepository) {}

  async execute(query: AdminVerifierQueueQueryInput): Promise<AdminVerifierQueuePage> {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const page = await this.evidence.listForAdmin({
      limit,
      cursor: query.cursor,
      domain: query.domain,
      status: query.status,
      q: query.q,
      sort: query.sort === '-submittedAt' ? 'submittedAtDesc' : 'submittedAt',
    });

    return {
      items: page.items.map((row) =>
        toSkillEvidenceView(row.evidence, {
          skillId: row.skillId,
          skillName: row.skillName,
          category: row.category,
          ownerId: row.ownerId,
        }),
      ),
      page: { limit, nextCursor: page.nextCursor, total: page.total },
    };
  }
}
