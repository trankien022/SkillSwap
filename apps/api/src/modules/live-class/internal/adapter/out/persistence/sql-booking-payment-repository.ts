import {
  bookingCancelledSchema,
  bookingConfirmedSchema,
} from '@skillswap/contracts';
import { insertOutboxStatement } from '../../../../../../shared/messaging/outbox-statements';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import type {
  RecordBookingPaymentCommand,
  RecordBookingPaymentResult,
} from '../../../application/port/in/record-booking-payment';
import { BookingPaymentMismatchError } from '../../../application/port/in/record-booking-payment';
import type { BookingPaymentRepository } from '../../../application/port/out/booking-payment-repository';
import type { BookingState, CancelReason } from '../../../domain/booking';
import { CANCEL_REASONS } from '../../../domain/booking';

const BOOKINGS = 'bookings';
const CLASSES = 'classes';
const PROCESSED_EVENTS = 'processed_events';
const BOOKING_CONFIRMED = 'booking.confirmed';
const BOOKING_CANCELLED = 'booking.cancelled';
const PAYMENT_RECEIPT_PREFIX = 'booking-payment:';
const ACTIVE_CLASS_STATES = ['published', 'full'] as const;

interface BookingHintRow {
  class_id: string;
}

interface ClassRow {
  id: string;
  teacher_id: string;
  state: string;
}

interface BookingRow {
  id: string;
  class_id: string;
  learner_id: string;
  state: BookingState;
  price_credits: number;
  expires_at: Date | string | null;
  cancel_reason: string | null;
  hold_active: boolean;
}

interface IdRow {
  id: string;
}

function asCancelReason(value: string | null): CancelReason {
  return CANCEL_REASONS.find((reason) => reason === value) ?? 'class_cancelled';
}

/**
 * Live-class owns booking state and its outbox. This adapter never queries wallet
 * storage: it validates the wallet outcome carried in the event contract.
 */
export class SqlBookingPaymentRepository implements BookingPaymentRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get schema(): string {
    return this.registry.getSchema(this.moduleName);
  }

  async applySuccessfulPayment(
    payment: RecordBookingPaymentCommand,
  ): Promise<RecordBookingPaymentResult> {
    const source = this.registry.get(this.moduleName);
    const bookings = qualified(this.schema, BOOKINGS);
    const classes = qualified(this.schema, CLASSES);
    const processedEvents = qualified(this.schema, PROCESSED_EVENTS);
    return source.transaction(async (manager) => {
      // Read the immutable class key, then lock in one order: class before booking.
      const hintRows = (await manager.query(
        `SELECT "class_id" FROM ${bookings} WHERE "id" = $1`,
        [payment.bookingId],
      )) as BookingHintRow[];
      const classId = hintRows[0]?.class_id;
      if (classId === undefined) {
        throw new BookingPaymentMismatchError('booking not found');
      }

      const classRows = (await manager.query(
        `SELECT "id", "teacher_id", "state" FROM ${classes} WHERE "id" = $1 FOR UPDATE`,
        [classId],
      )) as ClassRow[];
      const classRow = classRows[0];
      if (classRow === undefined) {
        throw new BookingPaymentMismatchError('class not found');
      }

      const bookingRows = (await manager.query(
        `SELECT "id", "class_id", "learner_id", "state", "price_credits", "expires_at",
                "cancel_reason", ("expires_at" IS NULL OR "expires_at" > now()) AS "hold_active"
           FROM ${bookings} WHERE "id" = $1 FOR UPDATE`,
        [payment.bookingId],
      )) as BookingRow[];
      const booking = bookingRows[0];
      if (
        booking === undefined ||
        booking.class_id !== classRow.id ||
        booking.learner_id !== payment.accountId ||
        booking.price_credits !== payment.amountCredits
      ) {
        throw new BookingPaymentMismatchError(
          booking === undefined
            ? 'booking not found after lock'
            : booking.class_id !== classRow.id
              ? 'class identity mismatch'
              : booking.learner_id !== payment.accountId
                ? 'learner identity mismatch'
                : 'amount mismatch',
        );
      }

      const receiptId = `${PAYMENT_RECEIPT_PREFIX}${payment.transactionId}`;
      const receipts = returnedRows<IdRow>(
        await manager.query(
          `INSERT INTO ${processedEvents} ("id", "status", "processed_at")
           VALUES ($1, 'DONE', now()) ON CONFLICT ("id") DO NOTHING RETURNING "id"`,
          [receiptId],
        ),
      );
      if (receipts.length === 0) {
        return { disposition: 'duplicate' };
      }

      if (booking.state === 'pending') {
        const holdEligible = booking.hold_active;
        const classEligible = (ACTIVE_CLASS_STATES as readonly string[]).includes(classRow.state);
        if (holdEligible && classEligible) {
          const changed = returnedRows<BookingRow>(
            await manager.query(
              `UPDATE ${bookings}
                  SET "state" = 'confirmed', "confirmed_at" = now(), "updated_at" = now(),
                      "expires_at" = NULL
                WHERE "id" = $1 AND "state" = 'pending'
                RETURNING "id", "class_id", "learner_id", "state", "price_credits", "expires_at",
                          "cancel_reason", true AS "hold_active"`,
              [booking.id],
            ),
          );
          if (changed.length !== 1) {
            throw new Error('Pending booking changed while applying wallet outcome');
          }
          const payload = bookingConfirmedSchema.parse({
            bookingId: booking.id,
            classId: classRow.id,
            studentId: booking.learner_id,
            teacherId: classRow.teacher_id,
            amountCredits: booking.price_credits,
            settled: true,
          });
          await manager.query(insertOutboxStatement(this.schema), [BOOKING_CONFIRMED, payload]);
          return { disposition: 'confirmed' };
        }

        const reason: CancelReason = !holdEligible ? 'expired' : 'class_cancelled';
        await this.cancelPendingAndEmit(manager, bookings, booking, classRow, reason);
        return { disposition: 'compensated' };
      }

      if (booking.state === 'cancelled') {
        await this.emitCompensation(
          manager,
          booking,
          classRow,
          asCancelReason(booking.cancel_reason),
        );
        return { disposition: 'compensated' };
      }

      // A duplicate payment for an already-settled or otherwise terminal booking
      // must not cancel/refund a legitimate completed or disputed booking.
      return { disposition: 'ignored' };
    });
  }

  private async cancelPendingAndEmit(
    manager: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    bookings: string,
    booking: BookingRow,
    classRow: ClassRow,
    reason: CancelReason,
  ): Promise<void> {
    const changed = returnedRows<BookingRow>(
      await manager.query(
        `UPDATE ${bookings}
            SET "state" = 'cancelled', "cancelled_at" = now(), "cancel_reason" = $2,
                "updated_at" = now()
          WHERE "id" = $1 AND "state" = 'pending'
          RETURNING "id", "class_id", "learner_id", "state", "price_credits", "expires_at",
                    "cancel_reason", false AS "hold_active"`,
        [booking.id, reason],
      ),
    );
    if (changed.length !== 1) {
      throw new Error('Pending booking changed while compensating wallet outcome');
    }
    await this.emitCompensation(manager, changed[0]!, classRow, reason);
  }

  private async emitCompensation(
    manager: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    booking: BookingRow,
    classRow: ClassRow,
    reason: CancelReason,
  ): Promise<void> {
    const payload = bookingCancelledSchema.parse({
      bookingId: booking.id,
      classId: classRow.id,
      learnerId: booking.learner_id,
      teacherId: classRow.teacher_id,
      priceCredits: booking.price_credits,
      reason,
    });
    await manager.query(insertOutboxStatement(this.schema), [BOOKING_CANCELLED, payload]);
  }
}
