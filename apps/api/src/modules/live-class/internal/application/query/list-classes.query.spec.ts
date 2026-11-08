import { ListClassesQueryHandler } from './list-classes.query';
import type {
  ClassListReader,
  FindClassesCriteria,
  ClassListRecord,
} from '../port/out/class-list-reader';
import type { Clock } from '../port/out/clock';
import type { PublicTeacherReader } from '../port/out/public-teacher-reader';
import type { AccountTrustReader } from '../port/out/account-trust';
import type { RatingRepository } from '../port/out/rating-repository';

describe('ListClassesQueryHandler', () => {
  const fixedNow = new Date('2026-10-12T12:00:00.000Z');
  let mockClassListReader: jest.Mocked<ClassListReader>;
  let mockPublicTeacherReader: jest.Mocked<PublicTeacherReader>;
  let mockAccountTrustReader: jest.Mocked<AccountTrustReader>;
  let mockRatingRepository: jest.Mocked<RatingRepository>;
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
    mockAccountTrustReader = {
      read: jest.fn(async (accountId: string) => ({
        verified: true,
        schoolName: accountId === 'teacher-known' ? 'FPT University' : null,
        approvedLevel: () => null,
      })),
    };
    // B5: a page of unrated classes — the default every pre-existing test expects.
    mockRatingRepository = {
      createForEligibleBooking: jest.fn(),
      readAggregate: jest.fn().mockResolvedValue(new Map()),
      readRecent: jest.fn().mockResolvedValue([]),
    };
    mockClock = {
      now: () => fixedNow,
    };
    handler = new ListClassesQueryHandler(
      mockClassListReader,
      mockPublicTeacherReader,
      mockAccountTrustReader,
      mockRatingRepository,
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
          title: 'Math 101',
          level: 'beginner',
          format: 'group',
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
          title: 'Physics 101',
          level: 'advanced',
          format: 'group',
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

    it('reads the aggregate once for the whole page and puts each class its own value (B5)', async () => {
      mockClassListReader.findClasses.mockResolvedValueOnce({
        items: [
          {
            id: 'cls-1',
            teacherId: 'teacher-a',
            skillIds: ['sk-1'],
            title: 'Math 101',
            level: 'beginner',
            format: 'group',
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
            teacherId: 'teacher-b',
            skillIds: ['sk-2'],
            title: 'Physics 101',
            level: 'advanced',
            format: 'group',
            description: 'Physics 101',
            startsAt: new Date('2026-10-16T10:00:00.000Z'),
            durationMinutes: 90,
            priceCredits: 150,
            capacity: 5,
            confirmedBookingsCount: 5,
            availableSeats: 0,
            state: 'full',
          },
          {
            id: 'cls-3',
            teacherId: 'teacher-c',
            skillIds: ['sk-3'],
            title: 'Chemistry 101',
            level: 'intermediate',
            format: 'one-on-one',
            description: 'Chemistry 101',
            startsAt: new Date('2026-10-17T10:00:00.000Z'),
            durationMinutes: 60,
            priceCredits: 90,
            capacity: 1,
            confirmedBookingsCount: 0,
            availableSeats: 1,
            state: 'published',
          },
        ],
        nextCursor: null,
      });
      mockRatingRepository.readAggregate.mockResolvedValueOnce(
        new Map([
          ['cls-1', { average: 4, count: 3 }],
          ['cls-2', { average: 4.5, count: 2 }],
        ]),
      );

      const result = await handler.execute({ callerId: 'learner-1' });

      // N+1 guard: a page of three classes is one aggregate query, not three.
      expect(mockRatingRepository.readAggregate).toHaveBeenCalledTimes(1);
      expect(mockRatingRepository.readAggregate).toHaveBeenCalledWith(['cls-1', 'cls-2', 'cls-3']);
      expect(result.items[0].averageRating).toBe(4);
      expect(result.items[0].ratingsCount).toBe(3);
      expect(result.items[1].averageRating).toBe(4.5);
      expect(result.items[1].ratingsCount).toBe(2);
      // A class nobody rated is absent from the map: null mean, zero count, not 0 stars.
      expect(result.items[2].averageRating).toBeNull();
      expect(result.items[2].ratingsCount).toBe(0);
    });

    it('reads the trust projection once per teacher and puts it on every item (B4)', async () => {
      const records: ClassListRecord[] = [
        {
          id: 'cls-1',
          teacherId: 'teacher-known',
          skillIds: ['sk-1'],
          title: 'Math 101',
          level: 'beginner',
          format: 'group',
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
          teacherId: 'teacher-known',
          skillIds: ['sk-1'],
          title: 'Math 102',
          level: 'advanced',
          format: 'group',
          description: 'Math 102',
          startsAt: new Date('2026-10-16T10:00:00.000Z'),
          durationMinutes: 60,
          priceCredits: 100,
          capacity: 10,
          confirmedBookingsCount: 0,
          availableSeats: 10,
          state: 'published',
        },
        {
          id: 'cls-3',
          teacherId: 'teacher-unverified',
          skillIds: ['sk-2'],
          title: 'Physics 101',
          level: null,
          format: 'one-on-one',
          description: 'Physics 101',
          startsAt: new Date('2026-10-17T10:00:00.000Z'),
          durationMinutes: 60,
          priceCredits: 80,
          capacity: 1,
          confirmedBookingsCount: 0,
          availableSeats: 1,
          state: 'published',
        },
      ];
      mockClassListReader.findClasses.mockResolvedValueOnce({ items: records, nextCursor: null });
      mockPublicTeacherReader.readMany.mockResolvedValueOnce([
        { id: 'teacher-known', displayName: 'Dr. Jane Doe' },
      ]);
      mockAccountTrustReader.read.mockImplementation(async (accountId: string) =>
        accountId === 'teacher-known'
          ? { verified: true, schoolName: 'FPT University', approvedLevel: () => 'expert' }
          : { verified: false, schoolName: null, approvedLevel: () => null },
      );

      const result = await handler.execute({ callerId: 'learner-1' });

      // Two rows from one teacher must not become two projection reads: it is one fact.
      expect(mockAccountTrustReader.read).toHaveBeenCalledTimes(2);
      expect(mockAccountTrustReader.read.mock.calls.map((c) => c[0])).toEqual([
        'teacher-known',
        'teacher-unverified',
      ]);
      expect(result.items[0].verified).toBe(true);
      expect(result.items[0].schoolName).toBe('FPT University');
      expect(result.items[1].verified).toBe(true);
      expect(result.items[1].schoolName).toBe('FPT University');
      // An account with no projection row is honestly unverified rather than assumed.
      expect(result.items[2].verified).toBe(false);
      expect(result.items[2].schoolName).toBeNull();
    });

    it('reports no school for a revoked verification (B4)', async () => {
      mockClassListReader.findClasses.mockResolvedValueOnce({
        items: [
          {
            id: 'cls-1',
            teacherId: 'teacher-revoked',
            skillIds: ['sk-1'],
            title: 'Math 101',
            level: 'beginner',
            format: 'group',
            description: 'Math 101',
            startsAt: new Date('2026-10-15T10:00:00.000Z'),
            durationMinutes: 60,
            priceCredits: 100,
            capacity: 10,
            confirmedBookingsCount: 0,
            availableSeats: 10,
            state: 'published',
          },
        ],
        nextCursor: null,
      });
      mockAccountTrustReader.read.mockResolvedValueOnce({
        verified: false,
        schoolName: null,
        approvedLevel: () => null,
      });

      const result = await handler.execute({ callerId: 'learner-1' });

      // The projection clears the school when the status leaves `approved`; the reader must not
      // resurrect it from anywhere else.
      expect(result.items[0].verified).toBe(false);
      expect(result.items[0].schoolName).toBeNull();
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
