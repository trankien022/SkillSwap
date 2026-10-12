import type { TeacherTrust } from '../../../domain/publish-policy';

export const TEACHER_TRUST_READER = Symbol('TeacherTrustReader');

/**
 * FR-005 / ADR-024 extension: read the locally-projected publish rights for a Teacher
 * (is a verified student; effective approved level per skill). Fed by events; never a
 * cross-schema read (ADR-014).
 */
export interface TeacherTrustReader {
  read(teacherId: string): Promise<TeacherTrust>;
}

export const TEACHER_TRUST_WRITER = Symbol('TeacherTrustWriter');

/** The verified-student flag projection for one account. */
export interface UpsertVerifiedTeacherRequest {
  readonly accountId: string;
  readonly verified: boolean;
  readonly occurredAt: string;
}

/** The effective approved level for one (teacher, skill). */
export interface UpsertSkillApprovalRequest {
  readonly accountId: string;
  readonly skillId: string;
  readonly approvedLevel: string | null;
  readonly occurredAt: string;
}

export interface TeacherTrustWriter {
  /** Idempotent (last-writer-wins by occurredAt), ADR-013. */
  upsertVerified(request: UpsertVerifiedTeacherRequest): Promise<void>;
  /** Idempotent (last-writer-wins by occurredAt); a null level clears the approval. */
  upsertSkillApproval(request: UpsertSkillApprovalRequest): Promise<void>;
}
