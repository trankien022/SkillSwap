import type {
  LearnerBookingItemDto,
  ListMyBookingsPort,
  ListMyBookingsQuery,
  MyBookingsPageDto,
} from '../port/in/list-my-bookings';
import { MAX_PAGE_LIMIT } from '@skillswap/contracts';
import type {
  MyBookingsReader,
} from '../port/out/my-bookings-reader';
import type { Clock } from '../port/out/clock';
import type { PublicTeacherReader } from '../port/out/public-teacher-reader';

const DEFAULT_OPEN_MINUTES = 15;
const NEUTRAL_TEACHER_NAME = 'SkillSwap';

/**
 * Route 22 / FR-007, FR-009, FR-011, FR-020: CQRS pure query handler for learner bookings.
 * Never imports domain aggregates, shared technical files, contracts, or web frameworks (ADR-009, ADR-012).
 * Strictly scoped to learnerId; handles roomAccessEligible window math, rating eligibility,
 * and bulk public teacher profile display name enrichment.
 */
export class ListMyBookingsQueryHandler implements ListMyBookingsPort {
  constructor(
    private readonly myBookingsReader: MyBookingsReader,
    private readonly publicTeacherReader: PublicTeacherReader,
    private readonly clock: Clock,
    private readonly openMinutes: number = DEFAULT_OPEN_MINUTES,
  ) {}

  async execute(query: ListMyBookingsQuery): Promise<MyBookingsPageDto> {
    const now = this.clock.now();
    const limit = Math.max(1, Math.min(query.limit ?? 20, MAX_PAGE_LIMIT));

    let parsedCursor: readonly [Date, string] | undefined;
    if (query.cursor) {
      const cursorDate = new Date(query.cursor[0]);
      if (Number.isNaN(cursorDate.getTime())) {
        throw new Error('Cursor startsAt is not a valid date string');
      }
      parsedCursor = [cursorDate, query.cursor[1]];
    }

    const [readerResult, totalUpcomingCount] = await Promise.all([
      this.myBookingsReader.findBookings({
        learnerId: query.learnerId,
        state: query.state,
        upcoming: query.upcoming,
        limit,
        cursor: parsedCursor,
        now,
      }),
      this.myBookingsReader.countTotalUpcoming(query.learnerId, now),
    ]);

    const uniqueTeacherIds = Array.from(
      new Set(readerResult.items.map((b) => b.class.teacherId)),
    );
    const teacherNameMap = new Map<string, string>();
    if (uniqueTeacherIds.length > 0) {
      const profiles = await this.publicTeacherReader.readMany(uniqueTeacherIds);
      for (const p of profiles) {
        if (p.displayName && p.displayName.trim() !== '') {
          teacherNameMap.set(p.id, p.displayName.trim());
        }
      }
    }

    const items: LearnerBookingItemDto[] = readerResult.items.map((record) => {
      const teacherDisplayName =
        teacherNameMap.get(record.class.teacherId) || NEUTRAL_TEACHER_NAME;

      const startsAtMs = record.class.startsAt.getTime();
      const opensAtMs = startsAtMs - this.openMinutes * 60 * 1000;
      const closesAtMs = startsAtMs + record.class.durationMinutes * 60 * 1000;
      const nowMs = now.getTime();
      const inWindow = nowMs >= opensAtMs && nowMs <= closesAtMs;
      const isTerminalClass =
        record.class.classState === 'completed' || record.class.classState === 'cancelled';

      const roomAccessEligible =
        record.state === 'confirmed' && !isTerminalClass && inWindow;

      const ratingEligible =
        record.state === 'confirmed' && record.class.classState === 'completed';
      const hasRated = record.hasRated ?? false;

      return {
        bookingId: record.bookingId,
        classId: record.classId,
        state: record.state,
        priceCredits: record.priceCredits,
        createdAt: record.createdAt.toISOString(),
        expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
        classSummary: {
          description: record.class.description,
          skillIds: record.class.skillIds,
          startsAt: record.class.startsAt.toISOString(),
          durationMinutes: record.class.durationMinutes,
          teacherId: record.class.teacherId,
          teacherDisplayName,
          classState: record.class.classState,
        },
        roomAccessEligible,
        ratingEligible,
        hasRated,
      };
    });

    return {
      items,
      nextCursor: readerResult.nextCursor,
      totalUpcomingCount,
    };
  }
}
