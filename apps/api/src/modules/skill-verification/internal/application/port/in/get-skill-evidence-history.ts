import type { SkillEvidenceHistoryView } from '@skillswap/contracts';

export const GET_SKILL_EVIDENCE_HISTORY = Symbol('GetSkillEvidenceHistory');

/**
 * FR-018: the full decision history of one evidence version's profile-skill
 * (all versions + their audit entries). Readable by the owner, the reviewing
 * Verifier, or an Administrator (ADR-028 §5).
 */
export interface GetSkillEvidenceHistoryCommand {
  evidenceId: string;
  viewerId: string;
  viewerRole: string | undefined;
}

export interface GetSkillEvidenceHistoryPort {
  execute(command: GetSkillEvidenceHistoryCommand): Promise<SkillEvidenceHistoryView>;
}
