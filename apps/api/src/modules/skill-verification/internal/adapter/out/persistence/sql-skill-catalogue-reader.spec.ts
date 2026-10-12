import type { DataSource } from 'typeorm';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { SqlSkillCatalogueReader } from './sql-skill-catalogue-reader';

describe('SqlSkillCatalogueReader', () => {
  let mockQuery: jest.Mock;
  let mockDataSource: DataSource;
  let mockRegistry: ModuleDataSourceRegistry;
  let reader: SqlSkillCatalogueReader;

  beforeEach(() => {
    mockQuery = jest.fn();
    mockDataSource = {
      query: mockQuery,
    } as unknown as DataSource;
    mockRegistry = {
      get: jest.fn().mockReturnValue(mockDataSource),
      getSchema: jest.fn().mockReturnValue('skill_verification'),
    } as unknown as ModuleDataSourceRegistry;
    reader = new SqlSkillCatalogueReader(mockRegistry, 'skill-verification');
  });

  it('queries the skills table in the skill_verification schema with active=true and ordering', async () => {
    mockQuery.mockResolvedValueOnce([
      { id: 'sk-1', name: 'TypeScript', category: 'Programming', active: true },
    ]);

    const result = await reader.findSkills({ limit: 10 });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];

    expect(sql).toContain('"skill_verification"."skills"');
    expect(sql).toContain('"active" = true');
    expect(sql).toContain('ORDER BY "category" ASC, "name" ASC, "id" ASC');
    expect(sql).not.toContain('skill_evidence');
    expect(sql).not.toContain('profile_skills');
    expect(sql).not.toContain('evidence_audit');
    expect(params).toEqual([11]); // limit + 1
    expect(result.items).toEqual([
      { id: 'sk-1', name: 'TypeScript', category: 'Programming', active: true },
    ]);
    expect(result.nextCursor).toBeNull();
  });

  it('filters by category case-insensitively', async () => {
    mockQuery.mockResolvedValueOnce([]);

    await reader.findSkills({ category: 'Languages', limit: 20 });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('LOWER("category") = LOWER($1)');
    expect(params[0]).toBe('Languages');
    expect(params[1]).toBe(21);
  });

  it('filters by keyword matching name or category', async () => {
    mockQuery.mockResolvedValueOnce([]);

    await reader.findSkills({ keyword: 'design', limit: 50 });

    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('("name" ILIKE $1 OR "category" ILIKE $1)');
    expect(params[0]).toBe('%design%');
  });

  it('handles deterministic tuple keyset pagination with delimiters and unicode', async () => {
    mockQuery.mockResolvedValueOnce([]);

    await reader.findSkills({
      cursor: ['Web | Cloud & DevOps', 'Lập trình C++ | C#', 'sk-unicode-99'],
      limit: 10,
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('("category", "name", "id"::text) > ($1, $2, $3)');
    expect(params).toEqual([
      'Web | Cloud & DevOps',
      'Lập trình C++ | C#',
      'sk-unicode-99',
      11,
    ]);
  });

  it('preserves page continuation ordering when multiple skills share the same name across different IDs', async () => {
    // Two skills with identical category and name, differing only by ID
    mockQuery.mockResolvedValueOnce([
      { id: '11111111-1111-4111-8111-111111111111', name: 'Graphic Design', category: 'Design', active: true },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Graphic Design', category: 'Design', active: true },
      { id: '33333333-3333-4333-8333-333333333333', name: 'UI Design', category: 'Design', active: true },
    ]);

    const result = await reader.findSkills({
      cursor: ['Design', 'Graphic Design', '00000000-0000-4000-8000-000000000000'],
      limit: 2,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.items[1].id).toBe('22222222-2222-4222-8222-222222222222');
    // nextCursor contains the exact tuple of the last item in the page
    expect(result.nextCursor).toEqual([
      'Design',
      'Graphic Design',
      '22222222-2222-4222-8222-222222222222',
    ]);
  });

  it('never executes bare-id lookup queries', async () => {
    mockQuery.mockResolvedValueOnce([]);

    await reader.findSkills({
      cursor: ['Tech', 'Node', 'sk-id'],
      limit: 10,
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).not.toContain('WHERE "id"::text = $1 LIMIT 1');
  });

  it('clamps limit to maximum 100 and minimum 1', async () => {
    mockQuery.mockResolvedValueOnce([]);

    await reader.findSkills({ limit: 500 });
    expect((mockQuery.mock.calls[0] as [string, unknown[]])[1]).toEqual([101]);

    mockQuery.mockResolvedValueOnce([]);
    await reader.findSkills({ limit: -5 });
    expect((mockQuery.mock.calls[1] as [string, unknown[]])[1]).toEqual([2]);
  });
});
