import {
  ListSkillsQueryHandler,
  mapSkillLevels,
  mapSkillToCatalogueItem,
} from './list-skills.query';
import type {
  FindSkillsParams,
  SkillCatalogueReader,
  SkillCatalogueReaderResult,
  SkillCatalogueRecord,
} from '../port/out/skill-catalogue-reader';
import type { SkillCursorTuple } from '../port/in/list-skills';

class MockSkillCatalogueReader implements SkillCatalogueReader {
  lastParams?: FindSkillsParams;
  result: SkillCatalogueReaderResult = { items: [], nextCursor: null };
  lastIds?: readonly string[];
  byId: readonly SkillCatalogueRecord[] = [];

  async findSkills(params: FindSkillsParams): Promise<SkillCatalogueReaderResult> {
    this.lastParams = params;
    return this.result;
  }

  async findSkillsByIds(ids: readonly string[]): Promise<readonly SkillCatalogueRecord[]> {
    this.lastIds = ids;
    return this.byId;
  }
}

describe('ListSkillsQueryHandler and level mapping', () => {
  describe('mapSkillLevels', () => {
    it('returns the fixed ordered scale levels from ADR-026', () => {
      const levels = mapSkillLevels();
      expect(levels).toEqual(['beginner', 'intermediate', 'advanced', 'expert']);
    });
  });

  describe('mapSkillToCatalogueItem', () => {
    it('maps skill record to catalogue item with explicit levels and without private fields', () => {
      const record = {
        id: 'sk-1',
        name: 'Node.js',
        category: 'Backend',
        active: true,
      };
      const item = mapSkillToCatalogueItem(record);
      expect(item).toEqual({
        id: 'sk-1',
        name: 'Node.js',
        category: 'Backend',
        levels: ['beginner', 'intermediate', 'advanced', 'expert'],
      });
      expect(item).not.toHaveProperty('active');
      expect(item).not.toHaveProperty('documentRef');
      expect(item).not.toHaveProperty('reviewerId');
    });
  });

  describe('ListSkillsQueryHandler.execute', () => {
    it('delegates query parameters to reader with default limit 50 and tuple cursor', async () => {
      const reader = new MockSkillCatalogueReader();
      const cursor: SkillCursorTuple = ['Programming', 'TypeScript', 'sk-1'];
      reader.result = {
        items: [{ id: 'sk-1', name: 'TypeScript', category: 'Programming', active: true }],
        nextCursor: cursor,
      };
      const handler = new ListSkillsQueryHandler(reader);

      const page = await handler.execute({
        keyword: 'Type',
        category: 'Programming',
        cursor,
      });

      expect(reader.lastParams).toEqual({
        category: 'Programming',
        keyword: 'Type',
        limit: 50,
        cursor,
      });
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toEqual({
        id: 'sk-1',
        name: 'TypeScript',
        category: 'Programming',
        levels: ['beginner', 'intermediate', 'advanced', 'expert'],
      });
      expect(page.nextCursor).toEqual(cursor);
    });

    it('passes explicit limit when provided', async () => {
      const reader = new MockSkillCatalogueReader();
      const handler = new ListSkillsQueryHandler(reader);

      await handler.execute({
        keyword: 'Python',
        category: 'Languages',
        limit: 20,
      });

      expect(reader.lastParams).toEqual({
        category: 'Languages',
        keyword: 'Python',
        limit: 20,
        cursor: undefined,
      });
    });
  });
});
