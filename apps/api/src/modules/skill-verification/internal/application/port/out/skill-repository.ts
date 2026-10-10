import type { Skill } from '../../../domain/evidence';

export const SKILL_REPOSITORY = Symbol('SkillRepository');

/**
 * FR-003 / ADR-026: read access to the managed skill catalogue. Evidence may only
 * reference a **known, active** skill, so submission resolves the skill here first.
 */
export interface SkillRepository {
  /** The active catalogue entry for an id, or null if unknown/inactive. */
  findActiveById(skillId: string): Promise<Skill | null>;
}
