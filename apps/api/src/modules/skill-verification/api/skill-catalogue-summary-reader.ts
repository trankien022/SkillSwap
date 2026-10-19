/**
 * FR-006 class detail: the skill catalogue facts a class page needs.
 *
 * A **facade port** in the same shape as `evidence-summary-reader.ts`: the live-class module
 * cannot read `skill_verification.skills` directly (ADR-014) and cannot import that module's
 * internals (ADR-005/ADR-011). It asks by id and gets back only catalogue metadata.
 *
 * The class detail view already returns `skillIds`; without this, every client that wants to
 * show the skill's name and category has to fetch the whole catalogue and join locally. That
 * join is what the web detail page did — by scanning `GET /classes?limit=50` first.
 */
export const SKILL_CATALOGUE_SUMMARY_READER = Symbol('SKILL_CATALOGUE_SUMMARY_READER');

export const SKILL_CATALOGUE_SUMMARY_LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
] as const;
export type SkillCatalogueSummaryLevel = (typeof SKILL_CATALOGUE_SUMMARY_LEVELS)[number];

export interface SkillCatalogueSummary {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  /** Levels the catalogue advertises for this skill, in the canonical order. */
  readonly levels: readonly SkillCatalogueSummaryLevel[];
}

export interface SkillCatalogueSummaryReader {
  /** Inactive or unknown ids are simply absent from the result; order is not guaranteed. */
  readMany(skillIds: readonly string[]): Promise<readonly SkillCatalogueSummary[]>;
}
