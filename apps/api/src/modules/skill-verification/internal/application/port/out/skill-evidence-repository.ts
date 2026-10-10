import type { ProfileSkill, SkillEvidence, SkillLevel } from '../../../domain/evidence';

export const PROFILE_SKILL_REPOSITORY = Symbol('ProfileSkillRepository');
export const SKILL_EVIDENCE_REPOSITORY = Symbol('SkillEvidenceRepository');

/** FR-003: a profile-skill joined with its catalogue entry, for the owner view. */
export interface ProfileSkillWithSkill {
  readonly id: string;
  readonly skillId: string;
  readonly skillName: string;
  readonly category: string;
  readonly approvedLevel: SkillLevel | null;
}

export interface ProfileSkillRepository {
  /** The account's existing link to a skill, or null. */
  findByAccountAndSkill(accountId: string, skillId: string): Promise<ProfileSkill | null>;
  /** All of the account's profile skills joined with their catalogue entries. */
  listByAccount(accountId: string): Promise<ProfileSkillWithSkill[]>;
  /**
   * Returns the account↔skill link, creating it (level NULL) if the account has
   * never linked this skill (ADR-026 §5).
   */
  findOrCreate(accountId: string, skillId: string): Promise<ProfileSkill>;
}

/** A new evidence version to persist. */
export interface CreateSkillEvidenceRequest {
  readonly id: string;
  readonly profileSkillId: string;
  readonly evidenceType: SkillEvidence['evidenceType'];
  readonly documentRef: string | null;
  readonly description: string | null;
  readonly requestedLevel: SkillLevel;
  readonly accountId: string;
  readonly skillId: string;
  readonly submittedAt: Date;
}

export interface SkillEvidenceRepository {
  /** The next version number for a profile-skill (1 when none exist yet). */
  nextVersion(profileSkillId: string): Promise<number>;
  /**
   * Inserts a new `pending` evidence version and writes the
   * `skill.evidence.submitted` outbox event in the **same transaction** (ADR-013).
   */
  create(request: CreateSkillEvidenceRequest): Promise<SkillEvidence>;
  /** All versions for a profile-skill, newest first (owner view; history is FR-018). */
  listByProfileSkill(profileSkillId: string): Promise<SkillEvidence[]>;
}
