import type {
  ClassListItemDto,
  ListClassesPageDto,
  ListClassesPort,
  ListClassesQuery,
} from '../port/in/list-classes';
import { MAX_PAGE_LIMIT } from '@skillswap/contracts';
import type {
  ClassListReader,
  ClassListRecord,
  FindClassesCriteria,
} from '../port/out/class-list-reader';
import type { Clock } from '../port/out/clock';
import type { PublicTeacherReader } from '../port/out/public-teacher-reader';
import type { AccountTrustReader } from '../port/out/account-trust';

const MARKETPLACE_LEAD_TIME_MS = 24 * 60 * 60 * 1000;
const NEUTRAL_TEACHER_NAME = 'SkillSwap';

/**
 * B4: only two facts off the trust projection are public class data. Declared structurally so this
 * read path never imports the domain aggregate (ADR-012, `live-class-queries-no-domain`).
 */
type TeacherVerification = Pick<
  Awaited<ReturnType<AccountTrustReader['read']>>,
  'verified' | 'schoolName'
>;

/**
 * Route 13 / FR-005, FR-006: query handler for listing classes in marketplace or own teaching mode.
 * CQRS read path (ADR-012: the read path never imports the domain aggregate).
 */
export class ListClassesQueryHandler implements ListClassesPort {
  constructor(
    private readonly classListReader: ClassListReader,
    private readonly publicTeacherReader: PublicTeacherReader,
    private readonly accountTrustReader: AccountTrustReader,
    private readonly clock: Clock,
  ) {}

  async execute(query: ListClassesQuery): Promise<ListClassesPageDto> {
    const now = this.clock.now();
    const isOwnMode = query.teacherId === 'me';
    const limit = Math.max(1, Math.min(query.limit ?? 20, MAX_PAGE_LIMIT));

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
      const items = await this.enrichTeachers(result.items);

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
    const items = await this.enrichTeachers(result.items);

    return {
      items,
      nextCursor: result.nextCursor,
    };
  }

  private async enrichTeachers(
    records: readonly ClassListRecord[],
  ): Promise<readonly ClassListItemDto[]> {
    if (records.length === 0) {
      return [];
    }

    const uniqueTeacherIds = Array.from(new Set(records.map((r) => r.teacherId)));
    const [profiles, trustByTeacher] = await Promise.all([
      this.publicTeacherReader.readMany(uniqueTeacherIds),
      this.readTrustOncePerTeacher(uniqueTeacherIds),
    ]);
    const nameMap = new Map<string, string>();
    for (const profile of profiles) {
      if (profile.displayName && profile.displayName.trim() !== '') {
        nameMap.set(profile.id, profile.displayName.trim());
      }
    }

    return records.map((record) => {
      const teacherDisplayName = nameMap.get(record.teacherId) || NEUTRAL_TEACHER_NAME;
      const trust = trustByTeacher.get(record.teacherId);
      return {
        id: record.id,
        teacherId: record.teacherId,
        teacherDisplayName,
        // B4: the university filter and the "verified only" toggle read these two fields.
        verified: trust?.verified ?? false,
        schoolName: trust?.schoolName ?? null,
        skillIds: record.skillIds,
        title: record.title,
        level: record.level,
        format: record.format,
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

  /**
   * B4: one projection read per distinct teacher. The page is at most 100 rows and is usually
   * published by a handful of teachers, so a per-row read would be up to 100 identical queries.
   */
  private async readTrustOncePerTeacher(
    teacherIds: readonly string[],
  ): Promise<ReadonlyMap<string, TeacherVerification>> {
    const entries = await Promise.all(
      teacherIds.map(async (teacherId) => [teacherId, await this.accountTrustReader.read(teacherId)] as const),
    );
    return new Map(entries);
  }
}
