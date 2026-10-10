import type { SkillEvidenceView } from '@skillswap/contracts';
import type { SkillEvidence } from '../domain/evidence';

/** Maps an evidence version to the owner-scoped API view (FR-003). */
export function toSkillEvidenceView(evidence: SkillEvidence, skillId: string): SkillEvidenceView {
  return {
    id: evidence.id,
    profileSkillId: evidence.profileSkillId,
    skillId,
    version: evidence.version,
    evidenceType: evidence.evidenceType,
    documentRef: evidence.documentRef,
    description: evidence.description,
    requestedLevel: evidence.requestedLevel,
    approvedLevel: evidence.approvedLevel,
    status: evidence.status,
    reason: evidence.reason,
    decidedAt: evidence.decidedAt?.toISOString() ?? null,
    submittedAt: evidence.submittedAt.toISOString(),
  };
}
