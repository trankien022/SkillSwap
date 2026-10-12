import {
  SKILL_CATALOGUE_LEVELS,
  type ListSkillsPort,
  type ListSkillsQuery,
  type SkillCatalogueItemDto,
  type SkillCatalogueLevelDto,
  type SkillCataloguePageDto,
} from '../port/in/list-skills';
import type {
  SkillCatalogueReader,
  SkillCatalogueRecord,
} from '../port/out/skill-catalogue-reader';

/**
 * Maps standard proficiency levels for a catalogue skill.
 * FR-003 / ADR-026: ordered level scale beginner | intermediate | advanced | expert.
 */
export function mapSkillLevels(): readonly SkillCatalogueLevelDto[] {
  return [...SKILL_CATALOGUE_LEVELS];
}

/**
 * Maps a persistence skill row into a catalogue item DTO with explicit proficiency levels.
 * Ensures only catalogue metadata and levels are exposed, never personal evidence.
 */
export function mapSkillToCatalogueItem(record: SkillCatalogueRecord): SkillCatalogueItemDto {
  return {
    id: record.id,
    name: record.name,
    category: record.category,
    levels: mapSkillLevels(),
  };
}

export class ListSkillsQueryHandler implements ListSkillsPort {
  constructor(private readonly reader: SkillCatalogueReader) {}

  async execute(query: ListSkillsQuery): Promise<SkillCataloguePageDto> {
    const limit = query.limit ?? 50;
    const result = await this.reader.findSkills({
      category: query.category,
      keyword: query.keyword,
      limit,
      cursor: query.cursor,
    });

    return {
      items: result.items.map(mapSkillToCatalogueItem),
      nextCursor: result.nextCursor,
    };
  }
}
