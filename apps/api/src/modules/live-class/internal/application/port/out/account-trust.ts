import type { TeacherTrust } from '../../../domain/publish-policy';

export const ACCOUNT_TRUST_READER = Symbol('AccountTrustReader');

/**
 * FR-005 / ADR-024 extension: read the locally-projected trust rights for one account —
 * is it a verified student, and what is its effective approved level per skill.
 *
 * Named for the **account**, not the Teacher (decision D2, closed 2026-10-26). The same
 * projection answers two gates that have nothing to do with teaching: the publish gate
 * (FR-005) and the booking gate (AC-034 / BR-001, a learner must be a verified student to
 * book at all). Calling it `TeacherTrustReader` made the second caller look like a mistake.
 *
 * Fed by events; never a cross-schema read (ADR-014).
 */
export interface AccountTrustReader {
  read(accountId: string): Promise<TeacherTrust>;
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
