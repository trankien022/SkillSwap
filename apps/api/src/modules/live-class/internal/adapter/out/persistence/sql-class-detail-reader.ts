import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type {
  BookingStateDto,
  ClassLifecycleStateDto,
} from '../../../application/port/in/get-class-detail';
import type {
  CallerBookingRecord,
  ClassDetailReader,
  ClassDetailRecord,
} from '../../../application/port/out/class-detail-reader';

const CLASSES_TABLE = 'classes';
const CLASS_SKILLS_TABLE = 'class_skills';
const BOOKINGS_TABLE = 'bookings';

interface RawClassDetailRow {
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

interface RawCallerBookingRow {
  id: string;
  state: string;
  expires_at: Date | string | null;
  created_at: Date | string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Route 14 / FR-005, FR-006, FR-007: SQL persistence reader for class detail.
 * Only accesses live_class tables (classes, class_skills, bookings) with zero cross-schema reads.
 * Protects learner privacy by querying bookings scoped strictly to callerId.
 */
export class SqlClassDetailReader implements ClassDetailReader {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get schema(): string {
    return this.registry.getSchema(this.moduleName);
  }

  async readDetail(
    classId: string,
    callerId: string,
    now: Date,
  ): Promise<ClassDetailRecord | null> {
    const source = this.registry.get(this.moduleName);
    const classes = qualified(this.schema, CLASSES_TABLE);
    const skills = qualified(this.schema, CLASS_SKILLS_TABLE);
    const bookings = qualified(this.schema, BOOKINGS_TABLE);

    const classSql = `
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
               OR (b."state" = 'pending' AND (b."expires_at" IS NULL OR b."expires_at" > $2))
             )
        ), 0) AS "held_seats_count"
      FROM ${classes} c
      WHERE c."id" = $1
      LIMIT 1
    `;

    const callerBookingsSql = `
      SELECT
        b."id",
        b."state",
        b."expires_at",
        b."created_at"
      FROM ${bookings} b
      WHERE b."class_id" = $1
        AND b."learner_id" = $2
      ORDER BY b."created_at" DESC, b."id" DESC
    `;

    const [classRows, bookingRows] = await Promise.all([
      source.query(classSql, [classId, now.toISOString()]) as Promise<RawClassDetailRow[]>,
      source.query(callerBookingsSql, [classId, callerId]) as Promise<RawCallerBookingRow[]>,
    ]);

    if (!classRows || classRows.length === 0) {
      return null;
    }

    const r = classRows[0];
    const confirmedCount = Number(r.confirmed_bookings_count);
    const heldCount = Number(r.held_seats_count);
    const availableSeats = Math.max(0, r.capacity - heldCount);

    const callerBookings: CallerBookingRecord[] = (bookingRows ?? []).map((b) => ({
      id: String(b.id),
      state: b.state as BookingStateDto,
      expiresAt: b.expires_at ? toDate(b.expires_at) : null,
      createdAt: toDate(b.created_at),
    }));

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
      heldSeatsCount: heldCount,
      availableSeats,
      state: r.state as ClassLifecycleStateDto,
      callerBookings,
    };
  }
}
