import { ratingViewSchema, type CreateRatingInput, type RatingView } from '@skillswap/contracts';
import type { PublicProfileReader } from '../../../../../account-profile/api';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import { RatingAlreadyExistsError, RatingNotEligibleError } from '../../../application/port/in/submit-rating';
import type {
  RatingAggregate,
  RatingRecentView,
  RatingRepository,
} from '../../../application/port/out/rating-repository';

interface BookingHint { class_id: string }
interface ClassRow { id: string; teacher_id: string; state: string }
interface BookingRow { id: string; class_id: string; learner_id: string; state: string }
interface RatingRow { id: string; booking_id: string; class_id: string; stars: number; comment: string; created_at: Date | string }
interface AggregateRow { class_id: string; total: string | number; count: string | number }
interface RecentRow { id: string; learner_id: string; stars: number; comment: string; created_at: Date | string }

/**
 * A learner with no readable profile still has to render as *something* — the contract requires a
 * non-empty name. This is the same neutral fallback the class list uses for a teacher, and it
 * claims nothing about the person.
 */
const NEUTRAL_LEARNER_NAME = 'SkillSwap learner';

/**
 * Mean of `stars` rounded to 2 decimals, from an exact integer sum. `AVG()` over `smallint` is a
 * `numeric`, which arrives as a string and has to be re-parsed; dividing the integer sum keeps the
 * arithmetic exact and makes the rounding rule testable without a database.
 *
 * A class with no ratings has **no** average (`null`), not `0` — zero stars is a verdict nobody gave.
 */
export function averageFrom(total: number, count: number): number | null {
  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }
  return Math.round((total / count) * 100) / 100;
}

/** Persists one rating per confirmed learner booking, and reads them back for the class pages. */
export class SqlRatingRepository implements RatingRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
    private readonly profiles: PublicProfileReader,
  ) {}
  private get schema(): string { return this.registry.getSchema(this.moduleName); }

  async createForEligibleBooking(bookingId: string, learnerId: string, input: CreateRatingInput): Promise<RatingView> {
    const source = this.registry.get(this.moduleName);
    const bookings = qualified(this.schema, 'bookings');
    const classes = qualified(this.schema, 'classes');
    const ratings = qualified(this.schema, 'ratings');
    try {
      return await source.transaction(async (manager) => {
        const hints = await manager.query(`SELECT "class_id" FROM ${bookings} WHERE "id" = $1`, [bookingId]) as BookingHint[];
        const classId = hints[0]?.class_id;
        if (!classId) throw new RatingNotEligibleError('Booking not found');
        const classRows = await manager.query(`SELECT "id", "teacher_id", "state" FROM ${classes} WHERE "id" = $1 FOR UPDATE`, [classId]) as ClassRow[];
        const classRow = classRows[0];
        const bookingRows = await manager.query(`SELECT "id", "class_id", "learner_id", "state" FROM ${bookings} WHERE "id" = $1 FOR UPDATE`, [bookingId]) as BookingRow[];
        const booking = bookingRows[0];
        if (!classRow || !booking || booking.class_id !== classRow.id || booking.learner_id !== learnerId || classRow.teacher_id === learnerId || booking.state !== 'confirmed' || classRow.state !== 'completed') {
          throw new RatingNotEligibleError('Only the learner of a confirmed booking may rate a completed class');
        }
        const rows = returnedRows<RatingRow>(await manager.query(
          `INSERT INTO ${ratings} ("booking_id", "class_id", "learner_id", "stars", "comment")
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT ("booking_id") DO NOTHING
           RETURNING "id", "booking_id", "class_id", "stars", "comment", "created_at"`,
          [bookingId, classRow.id, learnerId, input.stars, input.comment],
        ));
        if (rows.length !== 1) throw new RatingAlreadyExistsError();
        const row = rows[0]!;
        return ratingViewSchema.parse({
          id: row.id, bookingId: row.booking_id, classId: row.class_id,
          stars: row.stars, comment: row.comment,
          createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        });
      });
    } catch (error) {
      if (error instanceof RatingNotEligibleError || error instanceof RatingAlreadyExistsError) throw error;
      throw error;
    }
  }

  /**
   * FR-013: one grouped query for the whole page. A per-row aggregate would be the N+1 this read
   * path exists to avoid; classes with no ratings return no row and are simply absent from the map.
   */
  async readAggregate(classIds: readonly string[]): Promise<ReadonlyMap<string, RatingAggregate>> {
    const unique = Array.from(new Set(classIds));
    if (unique.length === 0) {
      return new Map();
    }
    const ratings = qualified(this.schema, 'ratings');
    const rows = (await this.registry.get(this.moduleName).query(
      `SELECT "class_id", SUM("stars")::bigint AS "total", COUNT(*)::int AS "count"
       FROM ${ratings}
       WHERE "class_id" = ANY($1::uuid[])
       GROUP BY "class_id"`,
      [unique],
    )) as AggregateRow[];

    const aggregate = new Map<string, RatingAggregate>();
    for (const row of rows) {
      const count = Number(row.count);
      aggregate.set(row.class_id, { average: averageFrom(Number(row.total), count), count });
    }
    return aggregate;
  }

  /**
   * FR-013: newest first, served by `ix_ratings_class_created`. Learner names come from the
   * account-profile facade — `account_profile` is another schema, so a join is not allowed
   * (ADR-014) and the ids travel to the reader instead.
   */
  async readRecent(classId: string, limit: number): Promise<readonly RatingRecentView[]> {
    const ratings = qualified(this.schema, 'ratings');
    const rows = (await this.registry.get(this.moduleName).query(
      `SELECT "id", "learner_id", "stars", "comment", "created_at"
       FROM ${ratings}
       WHERE "class_id" = $1
       ORDER BY "created_at" DESC, "id" DESC
       LIMIT $2`,
      [classId, limit],
    )) as RecentRow[];

    if (rows.length === 0) {
      return [];
    }

    const names = new Map<string, string>();
    const profiles = await this.profiles.readMany(rows.map((row) => row.learner_id));
    for (const profile of profiles) {
      if (profile.displayName.trim() !== '') {
        names.set(profile.id, profile.displayName.trim());
      }
    }

    return rows.map((row) => ({
      id: row.id,
      learnerDisplayName: names.get(row.learner_id) ?? NEUTRAL_LEARNER_NAME,
      stars: row.stars,
      comment: row.comment,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    }));
  }
}
