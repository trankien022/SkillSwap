import type { SkillEvidenceView } from '@skillswap/contracts';

export const LIST_VERIFIER_QUEUE = Symbol('ListVerifierQueue');

/** FR-004 / ADR-027: the expertise-scoped pending queue for a Verifier. */
export interface ListVerifierQueuePort {
  execute(verifierAccountId: string): Promise<SkillEvidenceView[]>;
}
