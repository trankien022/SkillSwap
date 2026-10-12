export const LIST_SKILLS = Symbol('ListSkills');

export const SKILL_CATALOGUE_LEVELS = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
] as const;
export type SkillCatalogueLevelDto = (typeof SKILL_CATALOGUE_LEVELS)[number];

export type SkillCursorTuple = readonly [category: string, name: string, id: string];

export interface ListSkillsQuery {
  readonly category?: string;
  readonly keyword?: string;
  readonly limit?: number;
  readonly cursor?: SkillCursorTuple;
}

export interface SkillCatalogueItemDto {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly levels: readonly SkillCatalogueLevelDto[];
}

export interface SkillCataloguePageDto {
  readonly items: readonly SkillCatalogueItemDto[];
  readonly nextCursor: SkillCursorTuple | null;
}

export interface ListSkillsPort {
  execute(query: ListSkillsQuery): Promise<SkillCataloguePageDto>;
}
