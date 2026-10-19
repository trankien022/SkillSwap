import type { SkillCursorTuple } from '../in/list-skills';

export const SKILL_CATALOGUE_READER = Symbol('SkillCatalogueReader');

export interface FindSkillsParams {
  readonly category?: string;
  readonly keyword?: string;
  readonly limit: number;
  readonly cursor?: SkillCursorTuple;
}

export interface SkillCatalogueRecord {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly active: boolean;
}

export interface SkillCatalogueReaderResult {
  readonly items: readonly SkillCatalogueRecord[];
  readonly nextCursor: SkillCursorTuple | null;
}

export interface SkillCatalogueReader {
  findSkills(params: FindSkillsParams): Promise<SkillCatalogueReaderResult>;
  /**
   * FR-006 class detail: resolve specific ids to catalogue metadata. Unknown and inactive ids
   * are omitted from the result; duplicates in `ids` are collapsed.
   */
  findSkillsByIds(ids: readonly string[]): Promise<readonly SkillCatalogueRecord[]>;
}
