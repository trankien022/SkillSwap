/**
 * FR-005 / SR-BR-002 / AC-002: the class **publish gate**.
 *
 * A class may be published only when the Teacher is a **verified student** and is
 * **approved for every class skill at the required level** (BR-008/BR-013/BR-065).
 * Teaching is gated on this — not on a role (ADR-030). Pricing is pure self-price
 * (OQ-002, resolved): `price >= 1` is already validated by `publishClass`.
 *
 * Pure domain: no framework, no persistence (ADR-009).
 */

import { SKILL_LEVEL_ORDER, type SkillLevel } from './skill-level';

export class UnverifiedTeacherError extends Error {
  constructor(teacherId: string) {
    super(`Teacher ${teacherId} is not a verified student`);
    this.name = 'UnverifiedTeacherError';
  }
}

export class SkillNotApprovedError extends Error {
  constructor(teacherId: string, skillId: string) {
    super(`Teacher ${teacherId} is not approved for skill ${skillId}`);
    this.name = 'SkillNotApprovedError';
  }
}

export class SkillLevelInsufficientError extends Error {
  constructor(teacherId: string, skillId: string, approved: SkillLevel, required: SkillLevel) {
    super(
      `Teacher ${teacherId} is approved at ${approved} for skill ${skillId}, ` +
        `below the required ${required}`,
    );
    this.name = 'SkillLevelInsufficientError';
  }
}

export class NoClassSkillsError extends Error {
  constructor() {
    super('A class must target at least one skill');
    this.name = 'NoClassSkillsError';
  }
}

/** The Teacher's projected trust: verified-student flag and per-skill approved level. */
export interface TeacherTrust {
  readonly verified: boolean;
  /** Effective approved level per skill (absent / null = not approved for that skill). */
  readonly approvedLevels: ReadonlyMap<string, SkillLevel | null>;
}

/** A class skill plus the minimum level the class targets (defaults to beginner). */
export interface RequiredClassSkill {
  readonly skillId: string;
  readonly requiredLevel?: SkillLevel;
}

/** Whether an approved level covers a required level on the ordered scale. */
export function levelCovers(approved: SkillLevel, required: SkillLevel): boolean {
  return SKILL_LEVEL_ORDER[approved] >= SKILL_LEVEL_ORDER[required];
}

/** The default required level for a class skill that declares none. */
export const DEFAULT_REQUIRED_LEVEL: SkillLevel = 'beginner';

/**
 * FR-005 / AC-002: asserts a class is publishable. Throws the specific error for the
 * failed clause so each branch is testable. Every class skill must be approved at or
 * above its required level, and the Teacher must be a verified student.
 */
export function assertPublishable(input: {
  teacherId: string;
  teacherTrust: TeacherTrust;
  classSkills: readonly RequiredClassSkill[];
}): void {
  if (input.classSkills.length === 0) {
    throw new NoClassSkillsError();
  }
  if (!input.teacherTrust.verified) {
    throw new UnverifiedTeacherError(input.teacherId);
  }
  for (const skill of input.classSkills) {
    const required = skill.requiredLevel ?? DEFAULT_REQUIRED_LEVEL;
    const approved = input.teacherTrust.approvedLevels.get(skill.skillId) ?? null;
    if (approved === null) {
      throw new SkillNotApprovedError(input.teacherId, skill.skillId);
    }
    if (!levelCovers(approved, required)) {
      throw new SkillLevelInsufficientError(input.teacherId, skill.skillId, approved, required);
    }
  }
}

/** Whether a class with these skills may be published (non-throwing form). */
export function isPublishable(input: {
  teacherId: string;
  teacherTrust: TeacherTrust;
  classSkills: readonly RequiredClassSkill[];
}): boolean {
  try {
    assertPublishable(input);
    return true;
  } catch {
    return false;
  }
}
