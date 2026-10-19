import { MAX_PAGE_LIMIT } from '@skillswap/contracts';
import type { Clock } from '../port/out/clock';
import type {
  LearnerBookingRecord,
  MyBookingsReader,
} from '../port/out/my-bookings-reader';
import type { PublicTeacherReader } from '../port/out/public-teacher-reader';
import { ListMyBookingsQueryHandler } from './list-my-bookings.query';

describe('ListMyBookingsQueryHandler', () => {
  let mockReader: jest.Mocked<MyBookingsReader>;
  let mockTeacherReader: jest.Mocked<PublicTeacherReader>;
  let mockClock: jest.Mocked<Clock>;
  let handler: ListMyBookingsQueryHandler;

  const fixedNow = new Date('2026-10-15T10:00:00.000Z');

  const createBookingRecord = (overrides: Partial<LearnerBookingRecord> = {}): LearnerBookingRecord => ({
    bookingId: 'bk-1',
    classId: 'cls-1',
    state: 'confirmed',
    priceCredits: 50,
    createdAt: new Date('2026-10-10T10:00:00.000Z'),
    expiresAt: null,
    class: {
      description: 'Distributed Systems',
      skillIds: ['sk-sys-1'],
      startsAt: new Date('2026-10-15T10:15:00.000Z'), // starts 15m after fixedNow
      durationMinutes: 60,
      teacherId: 'teacher-1',
      classState: 'published',
    },
    ...overrides,
  });

  beforeEach(() => {
    mockReader = {
      findBookings: jest.fn(),
      countTotalUpcoming: jest.fn(),
    };
    mockTeacherReader = {
      readMany: jest.fn().mockResolvedValue([
        { id: 'teacher-1', displayName: 'Prof. Dijkstra' },
      ]),
    };
    mockClock = {
      now: jest.fn().mockReturnValue(fixedNow),
    };
    handler = new ListMyBookingsQueryHandler(mockReader, mockTeacherReader, mockClock, 15);
  });

  describe('Strict learner ownership and query forwarding', () => {
    it('executes reader strictly with learnerId from query', async () => {
      mockReader.findBookings.mockResolvedValueOnce({ items: [], nextCursor: null });
      mockReader.countTotalUpcoming.mockResolvedValueOnce(3);

      await handler.execute({
        learnerId: 'learner-alice',
        state: 'confirmed',
        upcoming: true,
        limit: 10,
      });

      expect(mockReader.findBookings).toHaveBeenCalledWith({
        learnerId: 'learner-alice',
        state: 'confirmed',
        upcoming: true,
        limit: 10,
        cursor: undefined,
        now: fixedNow,
      });
      expect(mockReader.countTotalUpcoming).toHaveBeenCalledWith('learner-alice', fixedNow);
    });

    it('forwards explicit upcoming=false or undefined (omitted)', async () => {
      mockReader.findBookings.mockResolvedValue({ items: [], nextCursor: null });
      mockReader.countTotalUpcoming.mockResolvedValue(0);

      await handler.execute({ learnerId: 'learner-bob', upcoming: false });
      expect(mockReader.findBookings).toHaveBeenCalledWith(
        expect.objectContaining({ upcoming: false }),
      );

      await handler.execute({ learnerId: 'learner-bob', upcoming: undefined });
      expect(mockReader.findBookings).toHaveBeenCalledWith(
        expect.objectContaining({ upcoming: undefined }),
      );
    });

    it('bounds limit between 1 and the shared max page size and handles cursor parsing', async () => {
      mockReader.findBookings.mockResolvedValue({ items: [], nextCursor: null });
      mockReader.countTotalUpcoming.mockResolvedValue(0);

      await handler.execute({ learnerId: 'user-1', limit: 100 });
      expect(mockReader.findBookings).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 }),
      );

      await handler.execute({ learnerId: 'user-1', limit: 1000 });
      expect(mockReader.findBookings).toHaveBeenCalledWith(
        expect.objectContaining({ limit: MAX_PAGE_LIMIT }),
      );

      await handler.execute({ learnerId: 'user-1', limit: -5 });
      expect(mockReader.findBookings).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 1 }),
      );

      await handler.execute({
        learnerId: 'user-1',
        cursor: ['2026-10-15T12:00:00.000Z', 'bk-cursor-id'],
      });
      expect(mockReader.findBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: [new Date('2026-10-15T12:00:00.000Z'), 'bk-cursor-id'],
        }),
      );
    });

    it('throws if cursor startsAt date string is invalid', async () => {
      await expect(
        handler.execute({
          learnerId: 'user-1',
          cursor: ['invalid-date', 'bk-1'],
        }),
      ).rejects.toThrow('Cursor startsAt is not a valid date string');
    });
  });

  describe('Exact page-independent totalUpcomingCount', () => {
    it('returns exact totalUpcomingCount across all confirmed upcoming classes even on empty or filtered page', async () => {
      mockReader.findBookings.mockResolvedValueOnce({
        items: [], // empty page (e.g. limit=0 or past classes page)
        nextCursor: null,
      });
      mockReader.countTotalUpcoming.mockResolvedValueOnce(7);

      const result = await handler.execute({
        learnerId: 'learner-alice',
        upcoming: false,
      });

      expect(result.items).toHaveLength(0);
      expect(result.totalUpcomingCount).toBe(7);
    });
  });

  describe('roomAccessEligible time window edges and terminal denial', () => {
    it('allows room access exactly at opensAt window edge [startsAt - openMinutes]', async () => {
      // startsAt is 10:15, openMinutes is 15 -> opensAt is exactly 10:00:00.000Z == fixedNow
      const record = createBookingRecord({
        state: 'confirmed',
        class: {
          description: 'Class',
          skillIds: [],
          startsAt: new Date('2026-10-15T10:15:00.000Z'),
          durationMinutes: 60,
          teacherId: 'teacher-1',
          classState: 'published',
        },
      });

      mockReader.findBookings.mockResolvedValueOnce({ items: [record], nextCursor: null });
      mockReader.countTotalUpcoming.mockResolvedValueOnce(1);

      const result = await handler.execute({ learnerId: 'learner-1' });
      expect(result.items[0].roomAccessEligible).toBe(true);
    });

    it('allows room access exactly at closesAt window edge [startsAt + durationMinutes]', async () => {
      // startsAt is 09:00, duration 60m -> closesAt is 10:00:00.000Z == fixedNow
      const record = createBookingRecord({
        state: 'confirmed',
        class: {
          description: 'Class',
          skillIds: [],
          startsAt: new Date('2026-10-15T09:00:00.000Z'),
          durationMinutes: 60,
          teacherId: 'teacher-1',
          classState: 'in_progress',
        },
      });

      mockReader.findBookings.mockResolvedValueOnce({ items: [record], nextCursor: null });
      mockReader.countTotalUpcoming.mockResolvedValueOnce(0);

      const result = await handler.execute({ learnerId: 'learner-1' });
      expect(result.items[0].roomAccessEligible).toBe(true);
    });

    it('denies room access when 1ms before opensAt or 1ms after closesAt', async () => {
      // Too early: starts at 10:15:01 -> opens at 10:00:01 > fixedNow (10:00:00)
      const tooEarly = createBookingRecord({
        bookingId: 'bk-early',
        class: {
          description: 'Early',
          skillIds: [],
          startsAt: new Date('2026-10-15T10:15:01.000Z'),
          durationMinutes: 60,
          teacherId: 'teacher-1',
          classState: 'published',
        },
      });

      // Too late: starts at 08:59:59, duration 60m -> closes at 09:59:59 < fixedNow (10:00:00)
      const tooLate = createBookingRecord({
        bookingId: 'bk-late',
        class: {
          description: 'Late',
          skillIds: [],
          startsAt: new Date('2026-10-15T08:59:59.000Z'),
          durationMinutes: 60,
          teacherId: 'teacher-1',
          classState: 'in_progress',
        },
      });

      mockReader.findBookings.mockResolvedValueOnce({
        items: [tooEarly, tooLate],
        nextCursor: null,
      });
      mockReader.countTotalUpcoming.mockResolvedValueOnce(0);

      const result = await handler.execute({ learnerId: 'learner-1' });
      expect(result.items[0].roomAccessEligible).toBe(false);
      expect(result.items[1].roomAccessEligible).toBe(false);
    });

    it('conservatively denies room access for terminal classes (completed or cancelled) even within window', async () => {
      const completedClass = createBookingRecord({
        bookingId: 'bk-completed',
        class: {
          description: 'Completed',
          skillIds: [],
          startsAt: new Date('2026-10-15T09:30:00.000Z'),
          durationMinutes: 60,
          teacherId: 'teacher-1',
          classState: 'completed',
        },
      });

      const cancelledClass = createBookingRecord({
        bookingId: 'bk-cancelled',
        class: {
          description: 'Cancelled',
          skillIds: [],
          startsAt: new Date('2026-10-15T09:30:00.000Z'),
          durationMinutes: 60,
          teacherId: 'teacher-1',
          classState: 'cancelled',
        },
      });

      mockReader.findBookings.mockResolvedValueOnce({
        items: [completedClass, cancelledClass],
        nextCursor: null,
      });
      mockReader.countTotalUpcoming.mockResolvedValueOnce(0);

      const result = await handler.execute({ learnerId: 'learner-1' });
      expect(result.items[0].roomAccessEligible).toBe(false);
      expect(result.items[1].roomAccessEligible).toBe(false);
    });

    it('denies room access for non-confirmed bookings (pending or cancelled)', async () => {
      const pendingBooking = createBookingRecord({
        bookingId: 'bk-pending',
        state: 'pending',
      });
      const cancelledBooking = createBookingRecord({
        bookingId: 'bk-cancelled',
        state: 'cancelled',
      });

      mockReader.findBookings.mockResolvedValueOnce({
        items: [pendingBooking, cancelledBooking],
        nextCursor: null,
      });
      mockReader.countTotalUpcoming.mockResolvedValueOnce(0);

      const result = await handler.execute({ learnerId: 'learner-1' });
      expect(result.items[0].roomAccessEligible).toBe(false);
      expect(result.items[1].roomAccessEligible).toBe(false);
    });
  });

  describe('ratingEligible requires confirmed booking and ACTUAL completed class', () => {
    it('sets ratingEligible=true and hasRated=false for confirmed booking of completed class', async () => {
      const completed = createBookingRecord({
        state: 'confirmed',
        class: {
          description: 'Finished Class',
          skillIds: [],
          startsAt: new Date('2026-10-14T10:00:00.000Z'),
          durationMinutes: 60,
          teacherId: 'teacher-1',
          classState: 'completed',
        },
      });

      mockReader.findBookings.mockResolvedValueOnce({ items: [completed], nextCursor: null });
      mockReader.countTotalUpcoming.mockResolvedValueOnce(0);

      const result = await handler.execute({ learnerId: 'learner-1' });
      expect(result.items[0].ratingEligible).toBe(true);
      expect(result.items[0].hasRated).toBe(false);
    });

    it('does not simulate completed state from elapsed time alone if classState is in_progress', async () => {
      // Even if startsAt was yesterday and elapsed, classState is still in_progress
      const notFormallyCompleted = createBookingRecord({
        state: 'confirmed',
        class: {
          description: 'Not Formally Ended Class',
          skillIds: [],
          startsAt: new Date('2026-10-14T10:00:00.000Z'),
          durationMinutes: 60,
          teacherId: 'teacher-1',
          classState: 'in_progress',
        },
      });

      mockReader.findBookings.mockResolvedValueOnce({
        items: [notFormallyCompleted],
        nextCursor: null,
      });
      mockReader.countTotalUpcoming.mockResolvedValueOnce(0);

      const result = await handler.execute({ learnerId: 'learner-1' });
      expect(result.items[0].ratingEligible).toBe(false);
    });

    it('denies ratingEligible if booking state is pending or cancelled even if class is completed', async () => {
      const pendingRecord = createBookingRecord({
        state: 'pending',
        class: {
          description: 'Class',
          skillIds: [],
          startsAt: new Date('2026-10-14T10:00:00.000Z'),
          durationMinutes: 60,
          teacherId: 'teacher-1',
          classState: 'completed',
        },
      });

      mockReader.findBookings.mockResolvedValueOnce({ items: [pendingRecord], nextCursor: null });
      mockReader.countTotalUpcoming.mockResolvedValueOnce(0);

      const result = await handler.execute({ learnerId: 'learner-1' });
      expect(result.items[0].ratingEligible).toBe(false);
    });
  });

  describe('Public teacher bulk name facade enrichment', () => {
    it('enriches teacherDisplayName in bulk and falls back to SkillSwap', async () => {
      const b1 = createBookingRecord({
        bookingId: 'bk-1',
        class: {
          description: 'Class 1',
          skillIds: [],
          startsAt: new Date('2026-10-16T10:00:00.000Z'),
          durationMinutes: 60,
          teacherId: 'teacher-known',
          classState: 'published',
        },
      });

      const b2 = createBookingRecord({
        bookingId: 'bk-2',
        class: {
          description: 'Class 2',
          skillIds: [],
          startsAt: new Date('2026-10-17T10:00:00.000Z'),
          durationMinutes: 60,
          teacherId: 'teacher-unknown',
          classState: 'published',
        },
      });

      mockTeacherReader.readMany.mockResolvedValueOnce([
        { id: 'teacher-known', displayName: 'Ada Lovelace' },
      ]);

      mockReader.findBookings.mockResolvedValueOnce({ items: [b1, b2], nextCursor: null });
      mockReader.countTotalUpcoming.mockResolvedValueOnce(2);

      const result = await handler.execute({ learnerId: 'learner-1' });
      expect(mockTeacherReader.readMany).toHaveBeenCalledWith(
        expect.arrayContaining(['teacher-known', 'teacher-unknown']),
      );

      expect(result.items[0].classSummary.teacherDisplayName).toBe('Ada Lovelace');
      expect(result.items[1].classSummary.teacherDisplayName).toBe('SkillSwap');
    });
  });
});
