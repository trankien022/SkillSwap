import { ratingViewSchema, type CreateRatingInput, type RatingView } from '@skillswap/contracts';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import { RatingAlreadyExistsError, RatingNotEligibleError } from '../../../application/port/in/submit-rating';
import type { RatingRepository } from '../../../application/port/out/rating-repository';

interface BookingHint { class_id: string }
interface ClassRow { id: string; teacher_id: string; state: string }
interface BookingRow { id: string; class_id: string; learner_id: string; state: string }
interface RatingRow { id: string; booking_id: string; class_id: string; stars: number; comment: string; created_at: Date | string }

/** Persists one rating per confirmed learner booking within the live_class schema. */
export class SqlRatingRepository implements RatingRepository {
  constructor(private readonly registry: ModuleDataSourceRegistry, private readonly moduleName: string) {}
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
}
