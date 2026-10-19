import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { MAX_PAGE_LIMIT } from '@skillswap/contracts';
import type {
  BookingCursorTuple,
  BookingStateDto,
  ClassLifecycleStateDto,
} from '../../../application/port/in/list-my-bookings';
import type {
  FindMyBookingsCriteria,
  LearnerBookingRecord,
  MyBookingsReader,
  MyBookingsReaderResult,
} from '../../../application/port/out/my-bookings-reader';

const CLASSES_TABLE = 'classes';
const CLASS_SKILLS_TABLE = 'class_skills';
const BOOKINGS_TABLE = 'bookings';
const RATINGS_TABLE = 'ratings';

interface RawMyBookingRow {
  booking_id: string;
  class_id: string;
  booking_state: string;
  price_credits: number | string;
  booking_created_at: Date | string;
  booking_expires_at: Date | string | null;
  class_description: string;
  class_starts_at: Date | string;
  class_duration_minutes: number;
  class_teacher_id: string;
  class_state: string;
  skill_ids: string[] | null;
  has_rated: boolean;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Route 22 / FR-007, FR-009, FR-011, FR-020: SQL persistence reader for learner bookings.
 * Only accesses live_class tables (bookings, classes, class_skills) with zero cross-schema reads.
 * Protects learner privacy by scoping all reads strictly to learnerId.
 * Keyset ordered by c.starts_at ASC, b.id ASC.
 */
export class SqlMyBookingsReader implements MyBookingsReader {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get schema(): string {
    return this.registry.getSchema(this.moduleName);
  }

  async findBookings(criteria: FindMyBookingsCriteria): Promise<MyBookingsReaderResult> {
    const source = this.registry.get(this.moduleName);
    const classes = qualified(this.schema, CLASSES_TABLE);
    const skills = qualified(this.schema, CLASS_SKILLS_TABLE);
    const bookings = qualified(this.schema, BOOKINGS_TABLE);
    const ratings = qualified(this.schema, RATINGS_TABLE);

    const conditions: string[] = [];
    const queryParams: unknown[] = [];

    // Parameter 1 is always the learner ID (strict ownership check)
    queryParams.push(criteria.learnerId);
    conditions.push(`b."learner_id" = $${queryParams.length}`);

    if (criteria.state !== undefined) {
      queryParams.push(criteria.state);
      conditions.push(`b."state" = $${queryParams.length}`);
    }

    if (criteria.upcoming === true) {
      queryParams.push(criteria.now.toISOString());
      const nowIdx = queryParams.length;
      conditions.push(
        `(b."state" = 'confirmed' AND c."starts_at" > $${nowIdx} AND c."state" NOT IN ('cancelled', 'completed'))`,
      );
    } else if (criteria.upcoming === false) {
      queryParams.push(criteria.now.toISOString());
      const nowIdx = queryParams.length;
      conditions.push(
        `NOT (b."state" = 'confirmed' AND c."starts_at" > $${nowIdx} AND c."state" NOT IN ('cancelled', 'completed'))`,
      );
    }
    // When upcoming is undefined: omitted, returning all histories

    if (criteria.cursor !== undefined) {
      const [cursorStartsAt, cursorBookingId] = criteria.cursor;
      queryParams.push(cursorStartsAt.toISOString(), cursorBookingId);
      const bookingIdIdx = queryParams.length;
      const startsAtIdx = bookingIdIdx - 1;
      conditions.push(`((c."starts_at", b."id"::text) > ($${startsAtIdx}, $${bookingIdIdx}))`);
    }

    const limit = Math.max(1, Math.min(criteria.limit, MAX_PAGE_LIMIT));
    queryParams.push(limit + 1);
    const limitIdx = queryParams.length;

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const sql = `
      SELECT
        b."id" AS "booking_id",
        b."class_id" AS "class_id",
        b."state" AS "booking_state",
        b."price_credits" AS "price_credits",
        b."created_at" AS "booking_created_at",
        b."expires_at" AS "booking_expires_at",
        c."description" AS "class_description",
        c."starts_at" AS "class_starts_at",
        c."duration_minutes" AS "class_duration_minutes",
        c."teacher_id" AS "class_teacher_id",
        c."state" AS "class_state",
        EXISTS (SELECT 1 FROM ${ratings} r WHERE r."booking_id" = b."id") AS "has_rated",
        COALESCE((
          SELECT array_agg(s."skill_id" ORDER BY s."skill_id" ASC)
            FROM ${skills} s
           WHERE s."class_id" = c."id"
        ), '{}') AS "skill_ids"
      FROM ${bookings} b
      JOIN ${classes} c ON b."class_id" = c."id"
      ${whereClause}
      ORDER BY c."starts_at" ASC, b."id" ASC
      LIMIT $${limitIdx}
    `;

    const rows = (await source.query(sql, queryParams)) as RawMyBookingRow[];

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const items: LearnerBookingRecord[] = pageRows.map((r) => ({
      bookingId: String(r.booking_id),
      classId: String(r.class_id),
      state: r.booking_state as BookingStateDto,
      priceCredits: Number(r.price_credits),
      createdAt: toDate(r.booking_created_at),
      expiresAt: r.booking_expires_at ? toDate(r.booking_expires_at) : null,
      hasRated: r.has_rated,
      class: {
        description: r.class_description,
        skillIds: r.skill_ids ?? [],
        startsAt: toDate(r.class_starts_at),
        durationMinutes: Number(r.class_duration_minutes),
        teacherId: r.class_teacher_id,
        classState: r.class_state as ClassLifecycleStateDto,
      },
    }));

    const last = items[items.length - 1];
    const nextCursor: BookingCursorTuple | null =
      hasMore && last !== undefined ? [last.class.startsAt.toISOString(), last.bookingId] : null;

    return { items, nextCursor };
  }

  async countTotalUpcoming(learnerId: string, now: Date): Promise<number> {
    const source = this.registry.get(this.moduleName);
    const classes = qualified(this.schema, CLASSES_TABLE);
    const bookings = qualified(this.schema, BOOKINGS_TABLE);

    const sql = `
      SELECT COUNT(*)::int AS "count"
        FROM ${bookings} b
        JOIN ${classes} c ON b."class_id" = c."id"
       WHERE b."learner_id" = $1
         AND b."state" = 'confirmed'
         AND c."starts_at" > $2
         AND c."state" NOT IN ('cancelled', 'completed')
    `;

    const rows = (await source.query(sql, [learnerId, now.toISOString()])) as Array<{
      count: number | string;
    }>;
    return Number(rows[0]?.count ?? 0);
  }
}
