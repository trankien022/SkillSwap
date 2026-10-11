import type { SkillEvidenceView } from '@skillswap/contracts';
import { InactiveVerifierError, UnknownVerifierError } from '../domain/verifier';
import type {
  SkillEvidenceRepository,
  VerifierRepository,
} from './port/out/skill-evidence-repository';
import type { ListVerifierQueuePort } from './port/in/list-verifier-queue';
import { toSkillEvidenceView } from './skill-evidence-view';

/**
 * FR-004 / ADR-027: the expertise-scoped pending queue. A Verifier sees only
 * requests whose skill is in their expertise set (and only `pending`, unclaimed ones).
 * A non-Verifier or inactive Verifier gets an empty queue / error.
 */
export class ListVerifierQueueQueryHandler implements ListVerifierQueuePort {
  constructor(
    private readonly evidence: SkillEvidenceRepository,
    private readonly verifiers: VerifierRepository,
  ) {}

  async execute(verifierAccountId: string): Promise<SkillEvidenceView[]> {
    const verifier = await this.verifiers.findById(verifierAccountId);
    if (verifier === null) {
      throw new UnknownVerifierError(verifierAccountId);
    }
    if (verifier.status !== 'active') {
      throw new InactiveVerifierError(verifierAccountId, verifier.status);
    }

    const rows = await this.evidence.listPendingForExpertise(verifier.expertise);
    return rows.map((row) =>
      toSkillEvidenceView(row.evidence, {
        skillId: row.skillId,
        skillName: row.skillName,
        category: row.category,
        ownerId: row.ownerId,
      }),
    );
  }
}
