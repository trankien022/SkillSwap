import type { VerifierQueuePage } from '@skillswap/contracts';
import { InactiveVerifierError, UnknownVerifierError } from '../domain/verifier';
import type {
  SkillEvidenceRepository,
  VerifierRepository,
} from './port/out/skill-evidence-repository';
import {
  DEFAULT_QUEUE_LIMIT,
  type ListVerifierQueuePort,
  type ListVerifierQueueRequest,
} from './port/in/list-verifier-queue';
import { toSkillEvidenceView } from './skill-evidence-view';

/**
 * FR-004 / ADR-027: the expertise-scoped pending queue. A Verifier sees only
 * requests whose skill is in their expertise set (and only `pending`, unclaimed ones).
 * A non-Verifier or inactive Verifier gets an empty queue / error.
 *
 * FR-004 / NFR-014: the queue is bounded, keyset-paged and can be filtered by level,
 * evidence type and skill name, and sorted oldest-first (FIFO, default) or newest-first.
 */
export class ListVerifierQueueQueryHandler implements ListVerifierQueuePort {
  constructor(
    private readonly evidence: SkillEvidenceRepository,
    private readonly verifiers: VerifierRepository,
  ) {}

  async execute(request: ListVerifierQueueRequest): Promise<VerifierQueuePage> {
    const verifier = await this.verifiers.findById(request.verifierId);
    if (verifier === null) {
      throw new UnknownVerifierError(request.verifierId);
    }
    if (verifier.status !== 'active') {
      throw new InactiveVerifierError(request.verifierId, verifier.status);
    }

    const limit = request.limit ?? DEFAULT_QUEUE_LIMIT;
    const page = await this.evidence.listPendingForExpertise({
      expertise: verifier.expertise,
      limit,
      cursor: request.cursor,
      level: request.level,
      type: request.type,
      q: request.q,
      sort: request.sort === '-submittedAt' ? 'submittedAtDesc' : 'submittedAt',
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
