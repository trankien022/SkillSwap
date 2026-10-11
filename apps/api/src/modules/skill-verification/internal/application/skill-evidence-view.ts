import type { SkillEvidenceView } from '@skillswap/contracts';
import type { SkillEvidence } from '../domain/evidence';

/** Extra catalogue/ownership context the view carries (resolved by the caller). */
export interface SkillEvidenceContext {
  readonly skillId: string;
  readonly skillName?: string | null;
  readonly category?: string | null;
  readonly ownerId?: string | null;
}

/** Maps an evidence version to the API view (FR-003 submit + FR-004 queue). */
export function toSkillEvidenceView(
  evidence: SkillEvidence,
  context: SkillEvidenceContext,
): SkillEvidenceView {
  return {
    id: evidence.id,
    profileSkillId: evidence.profileSkillId,
    skillId: context.skillId,
    skillName: context.skillName ?? null,
    category: context.category ?? null,
    ownerId: context.ownerId ?? null,
    version: evidence.version,
    evidenceType: evidence.evidenceType,
    documentRef: evidence.documentRef,
    description: evidence.description,
    requestedLevel: evidence.requestedLevel,
    approvedLevel: evidence.approvedLevel,
    status: evidence.status,
    claimedBy: evidence.claimedBy,
    claimedAt: evidence.claimedAt?.toISOString() ?? null,
    reason: evidence.reason,
    decidedAt: evidence.decidedAt?.toISOString() ?? null,
    submittedAt: evidence.submittedAt.toISOString(),
  };
}
