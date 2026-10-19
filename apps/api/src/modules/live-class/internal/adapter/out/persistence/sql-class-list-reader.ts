import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { MAX_PAGE_LIMIT } from '@skillswap/contracts';
import type { ClassCursorTuple, ClassLifecycleStateDto } from '../../../application/port/in/list-classes';
import type {
  ClassListReader,
  ClassListReaderResult,
  ClassListRecord,
  FindClassesCriteria,
} from '../../../application/port/out/class-list-reader';

const CLASSES_TABLE = 'classes';
const CLASS_SKILLS_TABLE = 'class_skills';
const BOOKINGS_TABLE = 'bookings';

interface RawClassListRow {
  id: string;
  teacher_id: string;
  state: string;
  starts_at: Date | string;
  duration_minutes: number;
  price_credits: number;
  capacity: number;
  description: string;
  skill_ids: string[] | null;
  confirmed_bookings_count: number | string;
  held_seats_count: number | string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Route 13 / FR-005, FR-006: SQL persistence reader for classes marketplace and teacher teaching list.
 * Only accesses live_class tables (classes, class_skills, bookings) with zero cross-schema reads.
 * Pure read path using stable aggregation, EXISTS skill filtering, and keyset ordering (starts_at ASC, id ASC).
 */
export class SqlClassListReader implements ClassListReader {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get schema(): string {
    return this.registry.getSchema(this.moduleName);
  }

  async findClasses(criteria: FindClassesCriteria): Promise<ClassListReaderResult> {
    const source = this.registry.get(this.moduleName);
    const classes = qualified(this.schema, CLASSES_TABLE);
    const skills = qualified(this.schema, CLASS_SKILLS_TABLE);
    const bookings = qualified(this.schema, BOOKINGS_TABLE);

    const conditions: string[] = [];
    const queryParams: unknown[] = [];

    // Parameter 1 is always the now timestamp for held seat calculation
    queryParams.push(criteria.now.toISOString());
    const nowParamIdx = queryParams.length;

    if (criteria.mode === 'own') {
      queryParams.push(criteria.callerId);
      conditions.push(`c."teacher_id" = $${queryParams.length}`);

      if (criteria.state !== undefined) {
        queryParams.push(criteria.state);
        conditions.push(`c."state" = $${queryParams.length}`);
      }
    } else {
      // Marketplace mode
      if (criteria.teacherId !== undefined && criteria.teacherId.trim() !== '') {
        queryParams.push(criteria.teacherId.trim());
        conditions.push(`c."teacher_id" = $${queryParams.length}`);
      }

      if (criteria.state !== undefined) {
        queryParams.push(criteria.state);
        conditions.push(`c."state" = $${queryParams.length}`);
      } else {
        conditions.push(`c."state" IN ('published', 'full')`);
      }

      if (criteria.minStartsAt !== undefined) {
        queryParams.push(criteria.minStartsAt.toISOString());
        conditions.push(`c."starts_at" >= $${queryParams.length}`);
      }
    }

    if (criteria.startDate !== undefined) {
      queryParams.push(criteria.startDate.toISOString());
      conditions.push(`c."starts_at" >= $${queryParams.length}`);
    }

    if (criteria.endDate !== undefined) {
      queryParams.push(criteria.endDate.toISOString());
      conditions.push(`c."starts_at" <= $${queryParams.length}`);
    }

    if (criteria.keyword !== undefined && criteria.keyword.trim() !== '') {
      queryParams.push(`%${criteria.keyword.trim()}%`);
      conditions.push(`c."description" ILIKE $${queryParams.length}`);
    }

    if (criteria.skillId !== undefined && criteria.skillId.trim() !== '') {
      queryParams.push(criteria.skillId.trim());
      conditions.push(
        `EXISTS (SELECT 1 FROM ${skills} sf WHERE sf."class_id" = c."id" AND sf."skill_id" = $${queryParams.length})`,
      );
    }

    if (criteria.cursor !== undefined) {
      const [cursorStartsAt, cursorId] = criteria.cursor;
      queryParams.push(cursorStartsAt.toISOString(), cursorId);
      const idIdx = queryParams.length;
      const startsAtIdx = idIdx - 1;
      conditions.push(`(c."starts_at", c."id"::text) > ($${startsAtIdx}, $${idIdx})`);
    }

    const limit = Math.max(1, Math.min(criteria.limit, MAX_PAGE_LIMIT));
    queryParams.push(limit + 1);
    const limitIdx = queryParams.length;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        c."id",
        c."teacher_id",
        c."state",
        c."starts_at",
        c."duration_minutes",
        c."price_credits",
        c."capacity",
        c."description",
        COALESCE((
          SELECT array_agg(s."skill_id" ORDER BY s."skill_id" ASC)
            FROM ${skills} s
           WHERE s."class_id" = c."id"
        ), '{}') AS "skill_ids",
        COALESCE((
          SELECT COUNT(*)::int
            FROM ${bookings} b
           WHERE b."class_id" = c."id"
             AND b."state" = 'confirmed'
        ), 0) AS "confirmed_bookings_count",
        COALESCE((
          SELECT COUNT(*)::int
            FROM ${bookings} b
           WHERE b."class_id" = c."id"
             AND (
               b."state" = 'confirmed'
               OR (b."state" = 'pending' AND (b."expires_at" IS NULL OR b."expires_at" > $${nowParamIdx}))
             )
        ), 0) AS "held_seats_count"
      FROM ${classes} c
      ${whereClause}
      ORDER BY c."starts_at" ASC, c."id" ASC
      LIMIT $${limitIdx}
    `;

    const rows = (await source.query(sql, queryParams)) as RawClassListRow[];

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const items: ClassListRecord[] = pageRows.map((r) => {
      const confirmedCount = Number(r.confirmed_bookings_count);
      const heldCount = Number(r.held_seats_count);
      const availableSeats = Math.max(0, r.capacity - heldCount);

      return {
        id: String(r.id),
        teacherId: r.teacher_id,
        skillIds: r.skill_ids ?? [],
        description: r.description,
        startsAt: toDate(r.starts_at),
        durationMinutes: r.duration_minutes,
        priceCredits: r.price_credits,
        capacity: r.capacity,
        confirmedBookingsCount: confirmedCount,
        availableSeats,
        state: r.state as ClassLifecycleStateDto,
      };
    });

    const last = items[items.length - 1];
    const nextCursor: ClassCursorTuple | null =
      hasMore && last !== undefined ? [last.startsAt.toISOString(), last.id] : null;

    return { items, nextCursor };
  }

  async countActiveTeaching(teacherId: string, now: Date): Promise<number> {
    const source = this.registry.get(this.moduleName);
    const classes = qualified(this.schema, CLASSES_TABLE);

    const sql = `
      SELECT COUNT(*)::int AS "count"
        FROM ${classes}
       WHERE "teacher_id" = $1
         AND "state" IN ('published', 'full', 'in_progress')
         AND ("starts_at" + ("duration_minutes" || ' minutes')::interval) > $2
    `;

    const rows = (await source.query(sql, [teacherId, now.toISOString()])) as Array<{ count: number | string }>;
    return Number(rows[0]?.count ?? 0);
  }
}
