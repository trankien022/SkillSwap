import type { SkillEvidenceView } from '@skillswap/contracts';

export const CLAIM_SKILL_EVIDENCE = Symbol('ClaimSkillEvidence');

/** FR-004 / BR-071: a Verifier claims a pending request, locking it to them. */
export interface ClaimSkillEvidenceCommand {
  verifierId: string;
  evidenceId: string;
}

export interface ClaimSkillEvidencePort {
  execute(command: ClaimSkillEvidenceCommand): Promise<SkillEvidenceView>;
}
