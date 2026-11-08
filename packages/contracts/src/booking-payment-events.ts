import { z } from 'zod';
import { actorIdSchema } from './audit-actor';

/**
 * FR-007 / ADR-018 / ADR-032: canonical booking.confirmed event contract.
 * - Legacy request message (settled=false, default): triggers wallet settlement;
 *   classId is optional.
 * - Authoritative final event (settled=true): emitted after successful settlement;
 *   classId is REQUIRED and non-empty.
 */
export const bookingConfirmedSchema = z
  .object({
    bookingId: z.string().min(1),
    studentId: z.string().min(1),
    teacherId: z.string().min(1),
    amountCredits: z.number().int().positive(),
    settled: z.boolean().default(false),
    classId: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.settled && (!data.classId || data.classId.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'classId is required and non-empty when settled is true',
        path: ['classId'],
      });
    }
  });

export type BookingConfirmed = z.infer<typeof bookingConfirmedSchema>;

/**
 * ADR-031 / ADR-032: canonical wallet.transaction.completed event contract.
 * Emitted atomically within the wallet's local transaction when a wallet transaction completes.
 * - booking_payment: requires non-empty bookingId correlation and must have direction 'debit'.
 * - booking_refund: requires non-empty bookingId correlation and must have direction 'credit'.
 * - reversal: must have direction 'debit' — it takes money back after a settled top-up.
 * - other transaction types (top_up, income_release, platform_fee): bookingId is optional.
 *
 * **B11: why `reversal` was added.** The runbook recorded this as a deliberate gap rather than a
 * defect: `applyTopUp` with `direction: 'debit'` wrote a ledger row and the balance and announced
 * nothing, because the enum had no member that described what had happened. The gap was
 * unreachable then — an invoice number produced at most one settlement and nothing emitted a
 * reversal — so adding a member would have been inventing a contract with no producer. Now the
 * SePay `TRANSACTION_VOID` path does emit one, which is the moment the member earns its place.
 *
 * The direction refinement is not decoration: a reversal with `direction: 'credit'` would tell a
 * consumer that money arrived when it left, and the notification copy reads the type, not the
 * ledger. `top_up` deliberately has no direction rule — the settlement is a credit, but pinning
 * that here would reject a payload shape the existing producer legitimately sends.
 */
export const walletTransactionCompletedEventSchema = z
  .object({
    transactionId: z.string().min(1),
    accountId: z.string().min(1),
    type: z.enum([
      'top_up',
      'booking_payment',
      'booking_refund',
      'income_release',
      'platform_fee',
      'reversal',
    ]),
    amountCredits: z.number().int().positive(),
    direction: z.enum(['credit', 'debit']),
    occurredAt: z.string().datetime({ offset: true }),
    bookingId: z.string().min(1).optional(),
    /**
     * ADR-035: who acted. For a SePay IPN this is `SYSTEM_ACTOR_ID`, while `accountId` is the
     * **beneficiary** — the person whose balance moved. They are different facts and in the IPN
     * case they are different values: conflating them would record the person who received money
     * as the one who authorised it.
     */
    actorId: actorIdSchema,
  })
  .superRefine((data, ctx) => {
    if (data.type === 'booking_payment') {
      if (!data.bookingId || data.bookingId.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'bookingId is required and non-empty for booking_payment',
          path: ['bookingId'],
        });
      }
      if (data.direction !== 'debit') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'booking_payment must have direction debit',
          path: ['direction'],
        });
      }
    } else if (data.type === 'booking_refund') {
      if (!data.bookingId || data.bookingId.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'bookingId is required and non-empty for booking_refund',
          path: ['bookingId'],
        });
      }
      if (data.direction !== 'credit') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'booking_refund must have direction credit',
          path: ['direction'],
        });
      }
    } else if (data.type === 'reversal') {
      // B11: a reversal takes money back, so the direction is part of what the type means. A
      // reversal announced as a credit would read as money arriving; the inbox copy is chosen by
      // type, so the lie would survive all the way to the learner's screen.
      if (data.direction !== 'debit') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'reversal must have direction debit',
          path: ['direction'],
        });
      }
    }
  });

export type WalletTransactionCompletedEvent = z.infer<
  typeof walletTransactionCompletedEventSchema
>;
