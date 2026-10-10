import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { insertOutboxStatement } from '../../../../../../shared/messaging/outbox-statements';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import type {
  BookingRepository,
  BookingSeatRow,
  CreateBookingRecord,
  PersistedBooking,
} from '../../../application/port/out/booking-repository';
import type { BookingState, CancelReason } from '../../../domain/booking';

const BOOKINGS_TABLE = 'bookings';
const CLASSES_TABLE = 'classes';
const BOOKING_CONFIRMED_EVENT = 'booking.confirmed';
const BOOKING_CANCELLED_EVENT = 'booking.cancelled';

interface BookingRow {
  id: string;
  class_id: string;
  learner_id: string;
  state: string;
  price_credits: number;
  idempotency_key: string;
  created_at: Date | string;
  expires_at: Date | string | null;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toNullableDate(value: Date | string | null): Date | null {
  return value === null ? null : toDate(value);
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
    expiresAt: toNullableDate(row.expires_at),
  };
}

const BOOKING_COLUMNS =
  '"id", "class_id", "learner_id", "state", "price_credits", "idempotency_key", "created_at", "expires_at"';

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
      `SELECT ${BOOKING_COLUMNS} FROM ${table} WHERE "idempotency_key" = $1`,
      [idempotencyKey],
    )) as BookingRow[];
    const row = rows[0];
    return row === undefined ? null : toPersisted(row);
  }

  async findById(bookingId: string): Promise<PersistedBooking | null> {
    const source = this.registry.get(this.moduleName);
    const table = qualified(this.schema, BOOKINGS_TABLE);
    const rows = (await source.query(`SELECT ${BOOKING_COLUMNS} FROM ${table} WHERE "id" = $1`, [
      bookingId,
    ])) as BookingRow[];
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
        `SELECT ${BOOKING_COLUMNS} FROM ${bookings} WHERE "idempotency_key" = $1`,
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
        `INSERT INTO ${bookings} ("class_id", "learner_id", "state", "price_credits", "idempotency_key", "expires_at")
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${BOOKING_COLUMNS}`,
        [
          record.classId,
          record.learnerId,
          record.state,
          record.priceCredits,
          record.idempotencyKey,
          record.expiresAt.toISOString(),
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
    return source.transaction(async (manager) => {
      // Lock the booking row, then only confirm if still pending (FR-009 / AC-005).
      const locked = (await manager.query(
        `SELECT ${BOOKING_COLUMNS} FROM ${bookings} WHERE "id" = $1 AND "learner_id" = $2 FOR UPDATE`,
        [bookingId, learnerId],
      )) as BookingRow[];
      const current = locked[0];
      if (current === undefined || current.state !== 'pending') {
        return { confirmed: false, booking: current === undefined ? null : toPersisted(current) };
      }

      const confirmedRows = (await manager.query(
        `UPDATE ${bookings} SET "state" = 'confirmed', "confirmed_at" = now(), "updated_at" = now()
           WHERE "id" = $1
           RETURNING ${BOOKING_COLUMNS}`,
        [bookingId],
      )) as BookingRow[];
      const booking = toPersisted(returnedRows<BookingRow>(confirmedRows)[0]);
      await this.emitBookingEvent(manager, BOOKING_CONFIRMED_EVENT, booking, null);
      return { confirmed: true, booking };
    });
  }

  async cancelAndEmit(
    bookingId: string,
    reason: CancelReason,
  ): Promise<{ cancelled: boolean; booking: PersistedBooking | null }> {
    const source = this.registry.get(this.moduleName);
    const bookings = qualified(this.schema, BOOKINGS_TABLE);
    return source.transaction(async (manager) => {
      const locked = (await manager.query(
        `SELECT ${BOOKING_COLUMNS} FROM ${bookings} WHERE "id" = $1 FOR UPDATE`,
        [bookingId],
      )) as BookingRow[];
      const current = locked[0];
      if (current === undefined || (current.state !== 'pending' && current.state !== 'confirmed')) {
        return { cancelled: false, booking: current === undefined ? null : toPersisted(current) };
      }
      const cancelledRows = returnedRows<BookingRow>(
        await manager.query(
          `UPDATE ${bookings}
             SET "state" = 'cancelled', "cancelled_at" = now(), "cancel_reason" = $2, "updated_at" = now()
           WHERE "id" = $1
           RETURNING ${BOOKING_COLUMNS}`,
          [bookingId, reason],
        ),
      );
      const booking = toPersisted(cancelledRows[0]);
      await this.emitBookingEvent(manager, BOOKING_CANCELLED_EVENT, booking, reason);
      return { cancelled: true, booking };
    });
  }

  async expirePendingHolds(now: Date): Promise<number> {
    const source = this.registry.get(this.moduleName);
    const bookings = qualified(this.schema, BOOKINGS_TABLE);
    return source.transaction(async (manager) => {
      const expired = returnedRows<BookingRow>(
        await manager.query(
          `UPDATE ${bookings}
             SET "state" = 'cancelled', "cancelled_at" = now(), "cancel_reason" = 'expired', "updated_at" = now()
           WHERE "state" = 'pending' AND "expires_at" IS NOT NULL AND "expires_at" <= $1
           RETURNING ${BOOKING_COLUMNS}`,
          [now.toISOString()],
        ),
      );
      for (const row of expired) {
        await this.emitBookingEvent(manager, BOOKING_CANCELLED_EVENT, toPersisted(row), 'expired');
      }
      return expired.length;
    });
  }

  async countByClassAndState(classId: string, state: BookingState): Promise<number> {
    const source = this.registry.get(this.moduleName);
    const bookings = qualified(this.schema, BOOKINGS_TABLE);
    const rows = (await source.query(
      `SELECT COUNT(*)::int AS "count" FROM ${bookings} WHERE "class_id" = $1 AND "state" = $2`,
      [classId, state],
    )) as Array<{ count: number }>;
    return rows[0]?.count ?? 0;
  }

  async findActiveByClass(classId: string): Promise<PersistedBooking[]> {
    const source = this.registry.get(this.moduleName);
    const bookings = qualified(this.schema, BOOKINGS_TABLE);
    const rows = (await source.query(
      `SELECT ${BOOKING_COLUMNS} FROM ${bookings}
        WHERE "class_id" = $1 AND "state" IN ('pending', 'confirmed')`,
      [classId],
    )) as BookingRow[];
    return rows.map(toPersisted);
  }

  async hasTeacherNoShow(classId: string): Promise<boolean> {
    const source = this.registry.get(this.moduleName);
    const bookings = qualified(this.schema, BOOKINGS_TABLE);
    const rows = (await source.query(
      `SELECT 1 FROM ${bookings}
        WHERE "class_id" = $1 AND "state" = 'cancelled' AND "cancel_reason" = 'teacher_no_show'
        LIMIT 1`,
      [classId],
    )) as unknown[];
    return rows.length > 0;
  }

  /** Emits a booking event carrying the class's teacher so the wallet can settle/refund. */
  private async emitBookingEvent(
    manager: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    eventType: string,
    booking: PersistedBooking,
    reason: CancelReason | null,
  ): Promise<void> {
    const classes = qualified(this.schema, CLASSES_TABLE);
    const teacherRows = (await manager.query(
      `SELECT "teacher_id" FROM ${classes} WHERE "id" = $1`,
      [booking.classId],
    )) as Array<{ teacher_id: string }>;
    const teacherId = teacherRows[0]?.teacher_id;
    if (teacherId === undefined) {
      throw new Error(`Class ${booking.classId} not found for booking ${booking.id}`);
    }
    const payload: Record<string, unknown> = {
      bookingId: booking.id,
      classId: booking.classId,
      studentId: booking.learnerId,
      learnerId: booking.learnerId,
      teacherId,
      amountCredits: booking.priceCredits,
      priceCredits: booking.priceCredits,
    };
    if (reason !== null) {
      payload.reason = reason;
    }
    await manager.query(insertOutboxStatement(this.schema), [eventType, payload]);
  }
}
