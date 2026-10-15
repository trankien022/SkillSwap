import { SqlSkillEvidenceRepository } from './sql-skill-evidence-repository';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { InvalidCursorError } from '../../../../../../shared/errors';
import { encodeCursor } from '../../../../../../shared/http/keyset-cursor';

/**
 * FR-015 / NFR-014: the admin Verifier queue's SQL adapter.
 *
 * The distinguishing property of this read is that it has **no** expertise restriction — the
 * admin queue is about the work, not the caller — so the first thing pinned here is that no
 * `skill_id = ANY(...)` clause appears. The rest mirrors the verifier queue's guarantees: the
 * page and its count share filters and run together, filters are parameterised, and the keyset
 * uses the same tuple comparison as the sort.
 */

interface RecordedQuery {
  sql: string;
  params?: unknown[];
}

function createRecordingRegistry(responses: unknown[]) {
  const recordedQueries: RecordedQuery[] = [];
  const queue = [...responses];

  const mockQuery = jest.fn(async (sql: string, params?: unknown[]) => {
    recordedQueries.push({ sql, params });
    if (queue.length === 0) {
      throw new Error(`Unexpected query: ${sql}`);
    }
    const next = queue.shift();
    if (typeof next === 'function') {
      return (next as (sql: string, params?: unknown[]) => unknown)(sql, params);
    }
    if (next instanceof Error) {
      throw next;
    }
    return next;
  });

  const manager = { query: mockQuery };
  const dataSource = {
    query: mockQuery,
    // The admin read wraps its two statements in a transaction so they share a snapshot.
    transaction: jest.fn(async (fn: (m: typeof manager) => unknown) => fn(manager)),
  };
  const registry = {
    getSchema: jest.fn(() => 'skill_verification'),
    get: jest.fn(() => dataSource),
  } as unknown as ModuleDataSourceRegistry;

  return { registry, recordedQueries };
}

function evidenceRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'e-1',
    profile_skill_id: 'ps-1',
    evidence_type: 'certificate',
    document_ref: null,
    description: null,
    version: 1,
    requested_level: 'intermediate',
    approved_level: null,
    status: 'pending',
    claimed_by: null,
    claimed_at: null,
    reason: null,
    decided_at: null,
    submitted_at: new Date('2026-10-01T00:00:00.000Z'),
    owner_id: 'acc-1',
    skill_id: 'sk-1',
    skill_name: 'TypeScript',
    category: 'Programming',
    ...overrides,
  };
}

const baseQuery = { limit: 20 } as const;

describe('SqlSkillEvidenceRepository.listForAdmin', () => {
  it('does not restrict the queue to any expertise set', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlSkillEvidenceRepository(registry, 'skill-verification');

    await repository.listForAdmin({ ...baseQuery });

    for (const { sql } of recordedQueries) {
      expect(sql).not.toContain('ANY(');
    }
  });

  it('joins the taxonomy so the domain filter and category are available', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlSkillEvidenceRepository(registry, 'skill-verification');

    await repository.listForAdmin({ ...baseQuery });

    const { sql } = recordedQueries[0];
    expect(sql).toContain('"profile_skills"');
    expect(sql).toContain('"skills"');
    expect(sql).toContain('AS category');
  });

  it('filters by domain on the taxonomy category', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlSkillEvidenceRepository(registry, 'skill-verification');

    await repository.listForAdmin({ ...baseQuery, domain: 'Programming' });

    expect(recordedQueries[0].sql).toContain('s."category" = $1');
    expect(recordedQueries[0].params).toContain('Programming');
  });

  it('filters by status and skill name', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlSkillEvidenceRepository(registry, 'skill-verification');

    await repository.listForAdmin({ ...baseQuery, status: 'claimed', q: 'type' });

    expect(recordedQueries[0].sql).toContain('e."status" = $1');
    expect(recordedQueries[0].sql).toContain('s."name" ILIKE $2');
    expect(recordedQueries[0].params).toContain('claimed');
    expect(recordedQueries[0].params).toContain('%type%');
  });

  it('runs the page and the count together with the same filters', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlSkillEvidenceRepository(registry, 'skill-verification');

    await repository.listForAdmin({ ...baseQuery, domain: 'Languages', status: 'pending' });

    expect(recordedQueries).toHaveLength(2);
    expect(recordedQueries[1].sql).toContain('COUNT(*)');
    expect(recordedQueries[1].sql).toContain('e."status" = $1');
    expect(recordedQueries[1].sql).toContain('s."category" = $2');
    expect(recordedQueries[1].params).toEqual(['pending', 'Languages']);
    expect(recordedQueries[1].sql).not.toContain('LIMIT');
  });

  it('asks for limit+1 rows and returns the count from the count query', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([
      [evidenceRow()],
      [{ total: 7 }],
    ]);
    const repository = new SqlSkillEvidenceRepository(registry, 'skill-verification');

    const page = await repository.listForAdmin({ ...baseQuery, limit: 5 });

    expect(recordedQueries[0].params).toContain(6);
    expect(page.total).toBe(7);
    expect(page.items[0].skillName).toBe('TypeScript');
    expect(page.items[0].category).toBe('Programming');
    expect(page.items[0].ownerId).toBe('acc-1');
  });

  it('keysets on (submitted_at, id) ascending for the default order', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlSkillEvidenceRepository(registry, 'skill-verification');

    await repository.listForAdmin({
      ...baseQuery,
      cursor: encodeCursor(['2026-10-02T00:00:00.000Z', 'e-2']),
    });

    const { sql, params } = recordedQueries[0];
    expect(sql).toMatch(/\(e\."submitted_at", e\."id"\) > \(\$\d+::timestamptz, \$\d+::uuid\)/);
    expect(sql).toContain('ORDER BY e."submitted_at" ASC, e."id" ASC');
    expect(params).toContain('2026-10-02T00:00:00.000Z');
    expect(params).toContain('e-2');
  });

  it('flips the comparison and order for newest-first', async () => {
    const { registry, recordedQueries } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlSkillEvidenceRepository(registry, 'skill-verification');

    await repository.listForAdmin({
      ...baseQuery,
      sort: 'submittedAtDesc',
      cursor: encodeCursor(['2026-10-02T00:00:00.000Z', 'e-2']),
    });

    const { sql } = recordedQueries[0];
    expect(sql).toMatch(/\(e\."submitted_at", e\."id"\) < \(\$\d+::timestamptz, \$\d+::uuid\)/);
    expect(sql).toContain('ORDER BY e."submitted_at" DESC, e."id" DESC');
  });

  it('emits a next cursor from the last returned row', async () => {
    const rows = [
      evidenceRow({ id: 'e-1', submitted_at: new Date('2026-10-01T00:00:00.000Z') }),
      evidenceRow({ id: 'e-2', submitted_at: new Date('2026-10-02T00:00:00.000Z') }),
      evidenceRow({ id: 'e-3', submitted_at: new Date('2026-10-03T00:00:00.000Z') }),
    ];
    const { registry } = createRecordingRegistry([rows, [{ total: 3 }]]);
    const repository = new SqlSkillEvidenceRepository(registry, 'skill-verification');

    const page = await repository.listForAdmin({ ...baseQuery, limit: 2 });

    expect(page.items.map((item) => item.id)).toEqual(['e-1', 'e-2']);
    expect(page.nextCursor).toBe(encodeCursor(['2026-10-02T00:00:00.000Z', 'e-2']));
  });

  it('rejects a cursor that does not carry two key parts', async () => {
    const { registry } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlSkillEvidenceRepository(registry, 'skill-verification');

    await expect(
      repository.listForAdmin({ ...baseQuery, cursor: encodeCursor(['only-one']) }),
    ).rejects.toBeInstanceOf(InvalidCursorError);
  });

  it('returns an empty page with a zero total when nothing matches', async () => {
    const { registry } = createRecordingRegistry([[], [{ total: 0 }]]);
    const repository = new SqlSkillEvidenceRepository(registry, 'skill-verification');

    const page = await repository.listForAdmin({ ...baseQuery, domain: 'Nothing' });

    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
    expect(page.total).toBe(0);
  });
});
