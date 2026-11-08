import type { SkillEvidenceEvent, StudentVerificationEvent } from '@skillswap/contracts';
import type { TeacherTrustWriter } from './port/out/account-trust';

/**
 * FR-005 / ADR-024 (extension): projects trust events into the `live-class` publish-rights
 * projection. Idempotent through the writer (last-writer-wins by `occurredAt`), so a replayed
 * or out-of-order event is safe (ADR-013).
 */
export class ProjectTeacherTrustUseCase {
  constructor(private readonly writer: TeacherTrustWriter) {}

  /** `student.verification.*` → the verified-student flag and its school (BR-063/BR-065). */
  async onVerification(event: StudentVerificationEvent): Promise<void> {
    const approved = event.status === 'approved';
    await this.writer.upsertVerified({
      accountId: event.accountId,
      verified: approved,
      // B4: the school travels with the approval. Pending/rejected/revoked events clear it —
      // keeping the school after a revocation would keep claiming a status the account lost.
      schoolName: approved ? event.schoolName : null,
      occurredAt: event.occurredAt,
    });
  }

  /** `skill.evidence.*` → the effective approved level per skill (null unless approved). */
  async onSkillEvidence(event: SkillEvidenceEvent): Promise<void> {
    // Only an `approved` / `superseded` transition changes the effective level. A
    // `superseded` version clears the cached level for that skill until a replacement is
    // approved; the subsequent `approved` event (higher occurredAt) restores it.
    const approvedLevel = event.status === 'approved' ? (event.approvedLevel ?? null) : null;
    await this.writer.upsertSkillApproval({
      accountId: event.accountId,
      skillId: event.skillId,
      approvedLevel,
      occurredAt: event.occurredAt,
    });
  }
}
