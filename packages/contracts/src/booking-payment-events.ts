import { z } from 'zod';

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
 * - other transaction types (top_up, income_release, platform_fee): bookingId is optional.
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
    ]),
    amountCredits: z.number().int().positive(),
    direction: z.enum(['credit', 'debit']),
    occurredAt: z.string().datetime({ offset: true }),
    bookingId: z.string().min(1).optional(),
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
    }
  });

export type WalletTransactionCompletedEvent = z.infer<
  typeof walletTransactionCompletedEventSchema
>;
