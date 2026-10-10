import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { insertOutboxStatement } from '../../../../../../shared/messaging/outbox-statements';
import { qualified } from '../../../../../../shared/sql/ident';
import type {
  BookingRepository,
  BookingSeatRow,
  CreateBookingRecord,
  PersistedBooking,
} from '../../../application/port/out/booking-repository';
import type { BookingState } from '../../../domain/booking';

const BOOKINGS_TABLE = 'bookings';
const CLASSES_TABLE = 'classes';
const BOOKING_CONFIRMED_EVENT = 'booking.confirmed';

interface BookingRow {
  id: string;
  class_id: string;
  learner_id: string;
  state: string;
  price_credits: number;
  idempotency_key: string;
  created_at: Date | string;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toPersisted(row: BookingRow): PersistedBooking {
  return {
    id: row.id,
    classId: row.class_id,
    learnerId: row.learner_id,
    state: row.state as BookingState,
    priceCredits: row.price_credits,
    idempotencyKey: row.idempotency_key,
    createdAt: toDate(row.created_at),
  };
}

export class SqlBookingRepository implements BookingRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get schema(): string {
    return this.registry.getSchema(this.moduleName);
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<PersistedBooking | null> {
    const source = this.registry.get(this.moduleName);
    const table = qualified(this.schema, BOOKINGS_TABLE);
    const rows = (await source.query(
      `SELECT "id", "class_id", "learner_id", "state", "price_credits", "idempotency_key", "created_at"
         FROM ${table} WHERE "idempotency_key" = $1`,
      [idempotencyKey],
    )) as BookingRow[];
    const row = rows[0];
    return row === undefined ? null : toPersisted(row);
  }

  async createWithSeatGuard(
    record: CreateBookingRecord,
    guard: (seatRows: readonly BookingSeatRow[]) => void,
  ): Promise<{ booking: PersistedBooking; created: boolean }> {
    const source = this.registry.get(this.moduleName);
    const bookings = qualified(this.schema, BOOKINGS_TABLE);
    const classes = qualified(this.schema, CLASSES_TABLE);
    return source.transaction(async (manager) => {
      // Serialize seat decisions per class (AC-010).
      await manager.query(`SELECT "id" FROM ${classes} WHERE "id" = $1 FOR UPDATE`, [record.classId]);

      const existing = (await manager.query(
        `SELECT "id", "class_id", "learner_id", "state", "price_credits", "idempotency_key", "created_at"
           FROM ${bookings} WHERE "idempotency_key" = $1`,
        [record.idempotencyKey],
      )) as BookingRow[];
      if (existing[0] !== undefined) {
        return { booking: toPersisted(existing[0]), created: false };
      }

      const seatRows = (await manager.query(
        `SELECT "learner_id", "state" FROM ${bookings}
          WHERE "class_id" = $1 AND "state" IN ('pending', 'confirmed')`,
        [record.classId],
      )) as Array<{ learner_id: string; state: string }>;

      guard(seatRows.map((row) => ({ learnerId: row.learner_id, state: row.state as BookingState })));

      const inserted = (await manager.query(
        `INSERT INTO ${bookings} ("class_id", "learner_id", "state", "price_credits", "idempotency_key")
         VALUES ($1, $2, $3, $4, $5)
         RETURNING "id", "class_id", "learner_id", "state", "price_credits", "idempotency_key", "created_at"`,
        [
          record.classId,
          record.learnerId,
          record.state,
          record.priceCredits,
          record.idempotencyKey,
        ],
      )) as BookingRow[];
      const created = inserted[0];
      if (created === undefined) {
        throw new Error('Booking insert returned no row');
      }
      return { booking: toPersisted(created), created: true };
    });
  }

  async confirmAndEmit(
    bookingId: string,
    learnerId: string,
  ): Promise<{ confirmed: boolean; booking: PersistedBooking | null }> {
    const source = this.registry.get(this.moduleName);
    const bookings = qualified(this.schema, BOOKINGS_TABLE);
    const classes = qualified(this.schema, CLASSES_TABLE);
    return source.transaction(async (manager) => {
      // Lock the booking row, then only confirm if still pending (FR-009 / AC-005).
      const locked = (await manager.query(
        `SELECT "id", "class_id", "learner_id", "state", "price_credits", "idempotency_key", "created_at"
           FROM ${bookings} WHERE "id" = $1 AND "learner_id" = $2 FOR UPDATE`,
        [bookingId, learnerId],
      )) as BookingRow[];
      const current = locked[0];
      if (current === undefined || current.state !== 'pending') {
        return { confirmed: false, booking: current === undefined ? null : toPersisted(current) };
      }

      const confirmedRows = (await manager.query(
        `UPDATE ${bookings} SET "state" = 'confirmed', "updated_at" = now()
           WHERE "id" = $1
           RETURNING "id", "class_id", "learner_id", "state", "price_credits", "idempotency_key", "created_at"`,
        [bookingId],
      )) as BookingRow[];
      const booking = toPersisted(confirmedRows[0]);

      const teacherRows = (await manager.query(
        `SELECT "teacher_id" FROM ${classes} WHERE "id" = $1`,
        [current.class_id],
      )) as Array<{ teacher_id: string }>;
      const teacherId = teacherRows[0]?.teacher_id;
      if (teacherId === undefined) {
        throw new Error(`Class ${current.class_id} not found for booking ${bookingId}`);
      }

      await manager.query(insertOutboxStatement(this.schema), [
        BOOKING_CONFIRMED_EVENT,
        {
          bookingId: booking.id,
          studentId: booking.learnerId,
          teacherId,
          amountCredits: booking.priceCredits,
        },
      ]);
      return { confirmed: true, booking };
    });
  }
}
