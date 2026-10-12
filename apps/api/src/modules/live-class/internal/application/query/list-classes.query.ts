import type {
  ClassListItemDto,
  ListClassesPageDto,
  ListClassesPort,
  ListClassesQuery,
} from '../port/in/list-classes';
import type {
  ClassListReader,
  ClassListRecord,
  FindClassesCriteria,
} from '../port/out/class-list-reader';
import type { Clock } from '../port/out/clock';
import type { PublicTeacherReader } from '../port/out/public-teacher-reader';

const MARKETPLACE_LEAD_TIME_MS = 24 * 60 * 60 * 1000;
const NEUTRAL_TEACHER_NAME = 'SkillSwap';

/**
 * Route 13 / FR-005, FR-006: query handler for listing classes in marketplace or own teaching mode.
 * CQRS read path (ADR-012: the read path never imports the domain aggregate).
 */
export class ListClassesQueryHandler implements ListClassesPort {
  constructor(
    private readonly classListReader: ClassListReader,
    private readonly publicTeacherReader: PublicTeacherReader,
    private readonly clock: Clock,
  ) {}

  async execute(query: ListClassesQuery): Promise<ListClassesPageDto> {
    const now = this.clock.now();
    const isOwnMode = query.teacherId === 'me';
    const limit = Math.max(1, Math.min(query.limit ?? 20, 50));

    let parsedStartDate: Date | undefined;
    if (query.startDate) {
      parsedStartDate = new Date(query.startDate);
    }

    let parsedEndDate: Date | undefined;
    if (query.endDate) {
      parsedEndDate = new Date(query.endDate);
    }

    if (parsedStartDate && parsedEndDate && parsedStartDate.getTime() > parsedEndDate.getTime()) {
      throw new Error('startDate must be less than or equal to endDate');
    }

    let parsedCursor: readonly [Date, string] | undefined;
    if (query.cursor) {
      parsedCursor = [new Date(query.cursor[0]), query.cursor[1]];
    }

    let totalActiveTeachingCount: number | undefined;

    if (isOwnMode) {
      totalActiveTeachingCount = await this.classListReader.countActiveTeaching(query.callerId, now);

      const criteria: FindClassesCriteria = {
        mode: 'own',
        callerId: query.callerId,
        teacherId: query.callerId,
        keyword: query.keyword,
        skillId: query.skillId,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        state: query.state,
        limit,
        cursor: parsedCursor,
        now,
      };

      const result = await this.classListReader.findClasses(criteria);
      const items = await this.enrichTeacherDisplayNames(result.items);

      return {
        items,
        nextCursor: result.nextCursor,
        totalActiveTeachingCount,
      };
    }

    // Marketplace mode: only published and full classes starting >= now + 24 hours are visible.
    // If a private/draft/cancelled state is requested by an outsider, return empty results to prevent leak.
    if (query.state && query.state !== 'published' && query.state !== 'full') {
      return {
        items: [],
        nextCursor: null,
      };
    }

    const minStartsAt = new Date(now.getTime() + MARKETPLACE_LEAD_TIME_MS);

    const criteria: FindClassesCriteria = {
      mode: 'marketplace',
      callerId: query.callerId,
      teacherId: query.teacherId, // specific teacher UUID if provided
      keyword: query.keyword,
      skillId: query.skillId,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      state: query.state,
      minStartsAt,
      limit,
      cursor: parsedCursor,
      now,
    };

    const result = await this.classListReader.findClasses(criteria);
    const items = await this.enrichTeacherDisplayNames(result.items);

    return {
      items,
      nextCursor: result.nextCursor,
    };
  }

  private async enrichTeacherDisplayNames(
    records: readonly ClassListRecord[],
  ): Promise<readonly ClassListItemDto[]> {
    if (records.length === 0) {
      return [];
    }

    const uniqueTeacherIds = Array.from(new Set(records.map((r) => r.teacherId)));
    const profiles = await this.publicTeacherReader.readMany(uniqueTeacherIds);
    const nameMap = new Map<string, string>();
    for (const profile of profiles) {
      if (profile.displayName && profile.displayName.trim() !== '') {
        nameMap.set(profile.id, profile.displayName.trim());
      }
    }

    return records.map((record) => {
      const teacherDisplayName = nameMap.get(record.teacherId) || NEUTRAL_TEACHER_NAME;
      return {
        id: record.id,
        teacherId: record.teacherId,
        teacherDisplayName,
        skillIds: record.skillIds,
        description: record.description,
        startsAt: record.startsAt.toISOString(),
        durationMinutes: record.durationMinutes,
        priceCredits: record.priceCredits,
        capacity: record.capacity,
        confirmedBookingsCount: record.confirmedBookingsCount,
        availableSeats: record.availableSeats,
        state: record.state,
        averageRating: null,
        ratingsCount: 0,
      };
    });
  }
}
