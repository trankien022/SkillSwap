export const CLASS_SKILL_READER = Symbol('CLASS_SKILL_READER');

/** One catalogue skill a class teaches, as the detail view reports it. */
export interface ClassSkill {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly levels: readonly string[];
}

/**
 * FR-006: resolves the catalogue facts for the skills a class teaches.
 *
 * Declared here rather than re-exported from skill-verification so the query handler depends
 * only on this module's ports; the adapter in `adapter/out/skill-verification` binds it to the
 * other module's public facade.
 */
export interface ClassSkillReader {
  readMany(skillIds: readonly string[]): Promise<readonly ClassSkill[]>;
}
