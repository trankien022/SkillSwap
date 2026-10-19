import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { MAX_PAGE_LIMIT } from '@skillswap/contracts';
import type { SkillCursorTuple } from '../../../application/port/in/list-skills';
import type {
  FindSkillsParams,
  SkillCatalogueReader,
  SkillCatalogueReaderResult,
  SkillCatalogueRecord,
} from '../../../application/port/out/skill-catalogue-reader';

interface SkillRow {
  id: string;
  name: string;
  category: string;
  active: boolean;
}

/**
 * Route 09 / FR-003: queries the managed skills catalogue in the skill_verification schema.
 * Restricts access to own-schema 'skills' table without cross-schema reads or personal evidence exposure.
 * Keyset pagination orders strictly by ("category" ASC, "name" ASC, "id" ASC).
 */
export class SqlSkillCatalogueReader implements SkillCatalogueReader {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'skills');
  }

  async findSkills(params: FindSkillsParams): Promise<SkillCatalogueReaderResult> {
    const source = this.registry.get(this.moduleName);
    const limit = Math.max(1, Math.min(params.limit, MAX_PAGE_LIMIT));

    const conditions: string[] = ['"active" = true'];
    const queryParams: unknown[] = [];

    if (params.category !== undefined && params.category.trim() !== '') {
      queryParams.push(params.category.trim());
      conditions.push(`LOWER("category") = LOWER($${queryParams.length})`);
    }

    if (params.keyword !== undefined && params.keyword.trim() !== '') {
      queryParams.push(`%${params.keyword.trim()}%`);
      const paramIdx = queryParams.length;
      conditions.push(`("name" ILIKE $${paramIdx} OR "category" ILIKE $${paramIdx})`);
    }

    // Keyset pagination handling using deterministic [category, name, id] tuple
    if (params.cursor !== undefined) {
      const [cCategory, cName, cId] = params.cursor;
      queryParams.push(cCategory, cName, cId);
      const idxId = queryParams.length;
      const idxName = idxId - 1;
      const idxCat = idxId - 2;
      conditions.push(`("category", "name", "id"::text) > ($${idxCat}, $${idxName}, $${idxId})`);
    }

    // Fetch limit + 1 to detect hasMore
    queryParams.push(limit + 1);
    const limitParamIdx = queryParams.length;

    const sql = `
      SELECT "id", "name", "category", "active"
        FROM ${this.table}
       WHERE ${conditions.join(' AND ')}
       ORDER BY "category" ASC, "name" ASC, "id" ASC
       LIMIT $${limitParamIdx}
    `;

    const rows = (await source.query(sql, queryParams)) as SkillRow[];

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const items: SkillCatalogueRecord[] = pageRows.map((r) => ({
      id: String(r.id),
      name: r.name,
      category: r.category,
      active: r.active,
    }));

    const last = items[items.length - 1];
    const nextCursor: SkillCursorTuple | null =
      hasMore && last !== undefined ? [last.category, last.name, last.id] : null;

    return { items, nextCursor };
  }

  async findSkillsByIds(ids: readonly string[]): Promise<readonly SkillCatalogueRecord[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return [];
    }

    const source = this.registry.get(this.moduleName);
    const sql = `
      SELECT "id", "name", "category", "active"
        FROM ${this.table}
       WHERE "active" = true
         AND "id" = ANY($1::text[])
    `;

    const rows = (await source.query(sql, [unique])) as SkillRow[];
    return rows.map((r) => ({
      id: String(r.id),
      name: r.name,
      category: r.category,
      active: r.active,
    }));
  }
}
