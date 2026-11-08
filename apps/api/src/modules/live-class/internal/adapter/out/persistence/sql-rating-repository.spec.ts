import type { DataSource, EntityManager } from 'typeorm';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import type { PublicProfileReader } from '../../../../../account-profile/api';
import { RatingAlreadyExistsError, RatingNotEligibleError } from '../../../application/port/in/submit-rating';
import { SqlRatingRepository, averageFrom } from './sql-rating-repository';

describe('SqlRatingRepository', () => {
  const manager = { query: jest.fn() } as unknown as EntityManager;
  const query = jest.fn();
  const source = {
    query,
    transaction: jest.fn(async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager)),
  } as unknown as DataSource;
  const registry = { get: jest.fn().mockReturnValue(source), getSchema: jest.fn().mockReturnValue('live_class') } as unknown as ModuleDataSourceRegistry;
  const profiles: PublicProfileReader = { readMany: jest.fn() };
  const repository = new SqlRatingRepository(registry, 'live-class', profiles);
  beforeEach(() => jest.clearAllMocks());

  it('locks the class and booking, then persists an eligible owner rating', async () => {
    (manager.query as jest.Mock)
      .mockResolvedValueOnce([{ class_id: 'c1' }])
      .mockResolvedValueOnce([{ id: 'c1', teacher_id: 'teacher', state: 'completed' }])
      .mockResolvedValueOnce([{ id: 'b1', class_id: 'c1', learner_id: 'learner', state: 'confirmed' }])
      .mockResolvedValueOnce([{ id: 'r1', booking_id: 'b1', class_id: 'c1', stars: 5, comment: 'Good', created_at: new Date('2026-10-20T11:00:00.000Z') }]);
    await expect(repository.createForEligibleBooking('b1', 'learner', { stars: 5, comment: 'Good' })).resolves.toMatchObject({ bookingId: 'b1', classId: 'c1', stars: 5 });
    expect((manager.query as jest.Mock).mock.calls[1][0]).toContain('FOR UPDATE');
    expect((manager.query as jest.Mock).mock.calls[2][0]).toContain('FOR UPDATE');
    expect((manager.query as jest.Mock).mock.calls[3][0]).toContain('ON CONFLICT ("booking_id") DO NOTHING');
  });

  it('rejects non-owner and duplicate ratings', async () => {
    (manager.query as jest.Mock)
      .mockResolvedValueOnce([{ class_id: 'c1' }])
      .mockResolvedValueOnce([{ id: 'c1', teacher_id: 'teacher', state: 'completed' }])
      .mockResolvedValueOnce([{ id: 'b1', class_id: 'c1', learner_id: 'another-learner', state: 'confirmed' }])
      .mockResolvedValueOnce([{ class_id: 'c1' }])
      .mockResolvedValueOnce([{ id: 'c1', teacher_id: 'teacher', state: 'completed' }])
      .mockResolvedValueOnce([{ id: 'b1', class_id: 'c1', learner_id: 'learner', state: 'confirmed' }])
      .mockResolvedValueOnce([]);
    await expect(repository.createForEligibleBooking('b1', 'learner', { stars: 5, comment: 'Good' })).rejects.toBeInstanceOf(RatingNotEligibleError);
    await expect(repository.createForEligibleBooking('b1', 'learner', { stars: 5, comment: 'Good' })).rejects.toBeInstanceOf(RatingAlreadyExistsError);
    expect(manager.query).toHaveBeenCalledTimes(7);
  });

  describe('readAggregate (B5)', () => {
    it('turns an exact integer sum into a mean rounded to 2 decimals', () => {
      // 5 + 4 + 3 over 3 reviews is exactly 4 — not 4.000000001.
      expect(averageFrom(12, 3)).toBe(4);
      // 5 + 4 over 2 reviews is exactly 4.5 — the case a float AVG renders as 4.499999.
      expect(averageFrom(9, 2)).toBe(4.5);
      // A mean with more than 2 decimals is rounded, not truncated or left as raw float noise.
      expect(averageFrom(13, 3)).toBe(4.33);
      // No reviews means no mean. Zero would be a verdict nobody gave.
      expect(averageFrom(0, 0)).toBeNull();
    });

    it('asks the database once for the whole page and keys the result by class id', async () => {
      query.mockResolvedValueOnce([
        { class_id: 'c1', total: '12', count: 3 },
        { class_id: 'c2', total: '9', count: 2 },
      ]);

      const aggregate = await repository.readAggregate(['c1', 'c2', 'c3']);

      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      // One grouped statement for the page — a per-class statement would be the N+1.
      expect(sql).toContain('GROUP BY "class_id"');
      expect(sql).toContain('ANY($1::uuid[])');
      expect(params).toEqual([['c1', 'c2', 'c3']]);
      expect(aggregate.get('c1')).toEqual({ average: 4, count: 3 });
      expect(aggregate.get('c2')).toEqual({ average: 4.5, count: 2 });
      // An unrated class has no row, so it is absent rather than 0/0.
      expect(aggregate.has('c3')).toBe(false);
    });

    it('deduplicates ids and skips the database for an empty page', async () => {
      await repository.readAggregate([]);
      expect(query).not.toHaveBeenCalled();

      query.mockResolvedValueOnce([]);
      await repository.readAggregate(['c1', 'c1']);
      expect((query.mock.calls[0] as [string, unknown[]])[1]).toEqual([['c1']]);
    });
  });

  describe('readRecent (B5)', () => {
    it('reads newest first and resolves learner names through the account-profile facade', async () => {
      query.mockResolvedValueOnce([
        { id: 'r2', learner_id: 'learner-2', stars: 5, comment: 'Tuyệt vời', created_at: new Date('2026-10-21T09:00:00.000Z') },
        { id: 'r1', learner_id: 'learner-1', stars: 4, comment: 'Good', created_at: new Date('2026-10-20T09:00:00.000Z') },
      ]);
      (profiles.readMany as jest.Mock).mockResolvedValueOnce([
        { id: 'learner-1', displayName: '  An Nguyen  ' },
        { id: 'learner-2', displayName: 'Bình Trần' },
      ]);

      const recent = await repository.readRecent('c1', 5);

      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      // Served by ix_ratings_class_created: filter by class, order by created_at.
      expect(sql).toContain('WHERE "class_id" = $1');
      expect(sql).toContain('ORDER BY "created_at" DESC');
      expect(sql).toContain('LIMIT $2');
      expect(params).toEqual(['c1', 5]);
      // Names travel from account_profile through its facade — never a cross-schema join (ADR-014).
      expect(sql).not.toContain('account_profile');
      expect(profiles.readMany).toHaveBeenCalledWith(['learner-2', 'learner-1']);
      expect(recent).toEqual([
        { id: 'r2', learnerDisplayName: 'Bình Trần', stars: 5, comment: 'Tuyệt vời', createdAt: '2026-10-21T09:00:00.000Z' },
        { id: 'r1', learnerDisplayName: 'An Nguyen', stars: 4, comment: 'Good', createdAt: '2026-10-20T09:00:00.000Z' },
      ]);
    });

    it('falls back to a neutral name when a learner profile is missing or blank', async () => {
      query.mockResolvedValueOnce([
        { id: 'r1', learner_id: 'learner-gone', stars: 3, comment: 'ok', created_at: '2026-10-20T09:00:00.000Z' },
      ]);
      (profiles.readMany as jest.Mock).mockResolvedValueOnce([]);

      const recent = await repository.readRecent('c1', 5);

      // The contract requires a non-empty name; this claims nothing about the person.
      expect(recent[0]?.learnerDisplayName).toBe('SkillSwap learner');
      expect(recent[0]?.createdAt).toBe('2026-10-20T09:00:00.000Z');
    });

    it('skips the profile lookup when the class has no ratings', async () => {
      query.mockResolvedValueOnce([]);

      await expect(repository.readRecent('c1', 5)).resolves.toEqual([]);
      expect(profiles.readMany).not.toHaveBeenCalled();
    });
  });
});
