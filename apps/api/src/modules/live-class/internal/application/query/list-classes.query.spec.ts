import { ListClassesQueryHandler } from './list-classes.query';
import type {
  ClassListReader,
  FindClassesCriteria,
  ClassListRecord,
} from '../port/out/class-list-reader';
import type { Clock } from '../port/out/clock';
import type { PublicTeacherReader } from '../port/out/public-teacher-reader';

describe('ListClassesQueryHandler', () => {
  const fixedNow = new Date('2026-10-12T12:00:00.000Z');
  let mockClassListReader: jest.Mocked<ClassListReader>;
  let mockPublicTeacherReader: jest.Mocked<PublicTeacherReader>;
  let mockClock: Clock;
  let handler: ListClassesQueryHandler;

  beforeEach(() => {
    mockClassListReader = {
      findClasses: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
      countActiveTeaching: jest.fn().mockResolvedValue(0),
    };
    mockPublicTeacherReader = {
      readMany: jest.fn().mockResolvedValue([]),
    };
    mockClock = {
      now: () => fixedNow,
    };
    handler = new ListClassesQueryHandler(
      mockClassListReader,
      mockPublicTeacherReader,
      mockClock,
    );
  });

  describe('Marketplace mode vs Own teaching mode', () => {
    it('sets mode=marketplace and enforces starts_at >= now + 24h when teacherId is not me', async () => {
      await handler.execute({
        callerId: 'learner-1',
        limit: 20,
      });

      expect(mockClassListReader.findClasses).toHaveBeenCalledTimes(1);
      const criteria: FindClassesCriteria = mockClassListReader.findClasses.mock.calls[0][0];
      expect(criteria.mode).toBe('marketplace');
      expect(criteria.minStartsAt).toEqual(new Date(fixedNow.getTime() + 24 * 60 * 60 * 1000));
      expect(mockClassListReader.countActiveTeaching).not.toHaveBeenCalled();
    });

    it('sets mode=own with callerId as teacher, queries active count, and omits minStartsAt constraint', async () => {
      mockClassListReader.countActiveTeaching.mockResolvedValueOnce(5);

      const result = await handler.execute({
        callerId: 'teacher-caller-1',
        teacherId: 'me',
        limit: 10,
      });

      expect(mockClassListReader.countActiveTeaching).toHaveBeenCalledWith('teacher-caller-1', fixedNow);
      expect(mockClassListReader.findClasses).toHaveBeenCalledTimes(1);
      const criteria: FindClassesCriteria = mockClassListReader.findClasses.mock.calls[0][0];
      expect(criteria.mode).toBe('own');
      expect(criteria.teacherId).toBe('teacher-caller-1');
      expect(criteria.minStartsAt).toBeUndefined();
      expect(result.totalActiveTeachingCount).toBe(5);
    });

    it('immediately returns empty results when outsider requests non-public state in marketplace', async () => {
      const draftResult = await handler.execute({
        callerId: 'outsider-1',
        state: 'draft',
      });
      expect(draftResult).toEqual({ items: [], nextCursor: null });

      const cancelledResult = await handler.execute({
        callerId: 'outsider-1',
        teacherId: 'other-teacher-uuid',
        state: 'cancelled',
      });
      expect(cancelledResult).toEqual({ items: [], nextCursor: null });

      const inProgressResult = await handler.execute({
        callerId: 'outsider-1',
        state: 'in_progress',
      });
      expect(inProgressResult).toEqual({ items: [], nextCursor: null });

      expect(mockClassListReader.findClasses).not.toHaveBeenCalled();
    });

    it('allows own mode to query draft or cancelled states', async () => {
      mockClassListReader.countActiveTeaching.mockResolvedValueOnce(2);

      await handler.execute({
        callerId: 'teacher-1',
        teacherId: 'me',
        state: 'draft',
      });

      expect(mockClassListReader.findClasses).toHaveBeenCalledTimes(1);
      const criteria: FindClassesCriteria = mockClassListReader.findClasses.mock.calls[0][0];
      expect(criteria.mode).toBe('own');
      expect(criteria.state).toBe('draft');
    });
  });

  describe('Teacher display name bulk enrichment & neutral fallback', () => {
    it('enriches teacher names from public profile reader and falls back to SkillSwap when missing', async () => {
      const records: ClassListRecord[] = [
        {
          id: 'cls-1',
          teacherId: 'teacher-known',
          skillIds: ['sk-1'],
          description: 'Math 101',
          startsAt: new Date('2026-10-15T10:00:00.000Z'),
          durationMinutes: 60,
          priceCredits: 100,
          capacity: 10,
          confirmedBookingsCount: 2,
          availableSeats: 8,
          state: 'published',
        },
        {
          id: 'cls-2',
          teacherId: 'teacher-unknown',
          skillIds: ['sk-2'],
          description: 'Physics 101',
          startsAt: new Date('2026-10-16T10:00:00.000Z'),
          durationMinutes: 90,
          priceCredits: 150,
          capacity: 5,
          confirmedBookingsCount: 5,
          availableSeats: 0,
          state: 'full',
        },
      ];

      mockClassListReader.findClasses.mockResolvedValueOnce({
        items: records,
        nextCursor: ['2026-10-16T10:00:00.000Z', 'cls-2'],
      });

      mockPublicTeacherReader.readMany.mockResolvedValueOnce([
        { id: 'teacher-known', displayName: 'Dr. Jane Doe' },
      ]);

      const result = await handler.execute({ callerId: 'learner-1' });

      expect(mockPublicTeacherReader.readMany).toHaveBeenCalledWith(['teacher-known', 'teacher-unknown']);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].teacherDisplayName).toBe('Dr. Jane Doe');
      expect(result.items[1].teacherDisplayName).toBe('SkillSwap'); // Neutral fallback
      expect(result.items[0].averageRating).toBeNull();
      expect(result.items[0].ratingsCount).toBe(0);
      expect(result.items[1].averageRating).toBeNull();
      expect(result.items[1].ratingsCount).toBe(0);
      expect(result.nextCursor).toEqual(['2026-10-16T10:00:00.000Z', 'cls-2']);
    });
  });

  describe('Validation of date ordering and cursor parsing', () => {
    it('rejects startDate > endDate with error', async () => {
      await expect(
        handler.execute({
          callerId: 'learner-1',
          startDate: '2026-10-20T00:00:00.000Z',
          endDate: '2026-10-19T00:00:00.000Z',
        }),
      ).rejects.toThrow(/startDate must be less than or equal to endDate/);
    });

    it('passes parsed dates and cursor to criteria', async () => {
      await handler.execute({
        callerId: 'learner-1',
        startDate: '2026-10-15T00:00:00.000Z',
        endDate: '2026-10-25T00:00:00.000Z',
        cursor: ['2026-10-16T10:00:00.000Z', 'cls-10'],
        limit: 15,
      });

      const criteria = mockClassListReader.findClasses.mock.calls[0][0];
      expect(criteria.startDate).toEqual(new Date('2026-10-15T00:00:00.000Z'));
      expect(criteria.endDate).toEqual(new Date('2026-10-25T00:00:00.000Z'));
      expect(criteria.cursor).toEqual([new Date('2026-10-16T10:00:00.000Z'), 'cls-10']);
      expect(criteria.limit).toBe(15);
    });
  });
});
