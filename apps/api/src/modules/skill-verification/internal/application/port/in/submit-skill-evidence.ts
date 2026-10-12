import type { SkillEvidenceView } from '@skillswap/contracts';
import type { EvidenceType, SkillLevel } from '../../../domain/evidence';

export const SUBMIT_SKILL_EVIDENCE = Symbol('SubmitSkillEvidence');

/** FR-003 / API-002: a verified student submits evidence for a known skill. */
export interface SubmitSkillEvidenceCommand {
  accountId: string;
  skillId: string;
  requestedLevel: SkillLevel;
  evidenceType: EvidenceType;
  documentRef?: string;
  description?: string;
}

export interface SubmitSkillEvidencePort {
  execute(command: SubmitSkillEvidenceCommand): Promise<SkillEvidenceView>;
}
