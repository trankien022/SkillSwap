import type { SkillEvidenceView } from '@skillswap/contracts';
import type { SkillLevel } from '../../../domain/evidence';

export const DECIDE_SKILL_EVIDENCE = Symbol('DecideSkillEvidence');

/**
 * FR-004 / API-003: a Verifier approves or rejects a request they have claimed.
 * The Verifier must have claimed it; the skill must be within their expertise and
 * they must not be the owner (AC-018).
 */
export interface DecideSkillEvidenceCommand {
  reviewerId: string;
  evidenceId: string;
  decision: 'approve' | 'reject';
  approvedLevel?: SkillLevel;
  reason?: string;
}

export interface DecideSkillEvidencePort {
  execute(command: DecideSkillEvidenceCommand): Promise<SkillEvidenceView>;
}
