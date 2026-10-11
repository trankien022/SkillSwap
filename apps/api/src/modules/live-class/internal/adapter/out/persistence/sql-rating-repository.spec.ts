import type { DataSource, EntityManager } from 'typeorm';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { RatingAlreadyExistsError, RatingNotEligibleError } from '../../../application/port/in/submit-rating';
import { SqlRatingRepository } from './sql-rating-repository';

describe('SqlRatingRepository', () => {
  const manager = { query: jest.fn() } as unknown as EntityManager;
  const source = { transaction: jest.fn(async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager)) } as unknown as DataSource;
  const registry = { get: jest.fn().mockReturnValue(source), getSchema: jest.fn().mockReturnValue('live_class') } as unknown as ModuleDataSourceRegistry;
  const repository = new SqlRatingRepository(registry, 'live-class');
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
});
