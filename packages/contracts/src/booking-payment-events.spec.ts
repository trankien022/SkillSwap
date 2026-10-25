import { SYSTEM_ACTOR_ID } from './audit-actor';
import {
  bookingConfirmedSchema,
  walletTransactionCompletedEventSchema,
} from './booking-payment-events';

describe('booking-payment-events contracts (ADR-031 / ADR-032 / Phase C1)', () => {
  describe('bookingConfirmedSchema', () => {
    it('actualparselegacyrequestdefaultsfalse: parses legacy request messages with settled defaulted to false', () => {
      const legacyPayload = {
        bookingId: 'bk-123',
        studentId: 'std-456',
        teacherId: 'tch-789',
        amountCredits: 25,
      };

      const parsed = bookingConfirmedSchema.parse(legacyPayload);
      expect(parsed.bookingId).toBe('bk-123');
      expect(parsed.studentId).toBe('std-456');
      expect(parsed.teacherId).toBe('tch-789');
      expect(parsed.amountCredits).toBe(25);
      expect(parsed.settled).toBe(false);
      expect(parsed.classId).toBeUndefined();
    });

    it('finalsettledrequiresclassId: requires non-empty classId when settled is true', () => {
      const baseFinal = {
        bookingId: 'bk-123',
        studentId: 'std-456',
        teacherId: 'tch-789',
        amountCredits: 25,
        settled: true,
      };

      // Missing classId is denied when settled is true
      expect(() => bookingConfirmedSchema.parse(baseFinal)).toThrow(
        /classId is required and non-empty when settled is true/,
      );

      // Empty classId is denied
      expect(() => bookingConfirmedSchema.parse({ ...baseFinal, classId: '' })).toThrow();

      // Whitespace-only classId is denied
      expect(() => bookingConfirmedSchema.parse({ ...baseFinal, classId: '   ' })).toThrow();

      // Valid classId succeeds for authoritative final settled event
      const parsed = bookingConfirmedSchema.parse({ ...baseFinal, classId: 'cls-999' });
      expect(parsed.settled).toBe(true);
      expect(parsed.classId).toBe('cls-999');
    });

    it('explicitrequestallowsclassId andfalse: explicit settled=false allows classId or omitting it', () => {
      const withoutClass = bookingConfirmedSchema.parse({
        bookingId: 'bk-123',
        studentId: 'std-456',
        teacherId: 'tch-789',
        amountCredits: 25,
        settled: false,
      });
      expect(withoutClass.settled).toBe(false);
      expect(withoutClass.classId).toBeUndefined();

      const withClass = bookingConfirmedSchema.parse({
        bookingId: 'bk-123',
        studentId: 'std-456',
        teacherId: 'tch-789',
        amountCredits: 25,
        settled: false,
        classId: 'cls-999',
      });
      expect(withClass.settled).toBe(false);
      expect(withClass.classId).toBe('cls-999');
    });

    it('positiveinteger/nozero/no floats: enforces positive integer credits for bookings', () => {
      const base = {
        bookingId: 'bk-123',
        studentId: 'std-456',
        teacherId: 'tch-789',
      };

      // Zero credits rejected
      expect(() => bookingConfirmedSchema.parse({ ...base, amountCredits: 0 })).toThrow();

      // Negative credits rejected
      expect(() => bookingConfirmedSchema.parse({ ...base, amountCredits: -10 })).toThrow();

      // Float / fractional credits rejected
      expect(() => bookingConfirmedSchema.parse({ ...base, amountCredits: 25.5 })).toThrow();

      // Valid positive integer accepted
      const parsed = bookingConfirmedSchema.parse({ ...base, amountCredits: 50 });
      expect(parsed.amountCredits).toBe(50);
    });

    it('rejects empty identifier strings', () => {
      const valid = {
        bookingId: 'bk-1',
        studentId: 'std-1',
        teacherId: 'tch-1',
        amountCredits: 10,
      };

      expect(() => bookingConfirmedSchema.parse({ ...valid, bookingId: '' })).toThrow();
      expect(() => bookingConfirmedSchema.parse({ ...valid, studentId: '' })).toThrow();
      expect(() => bookingConfirmedSchema.parse({ ...valid, teacherId: '' })).toThrow();
    });
  });

  describe('walletTransactionCompletedEventSchema', () => {
    const validOccurredAt = '2026-10-12T03:00:00.000Z';

    it('correlatedsuccessfulpayment/refund directioncorrect: enforces debit for payment and credit for refund', () => {
      // Successful booking_payment must have direction debit
      const payment = walletTransactionCompletedEventSchema.parse({
        transactionId: 'tx-001',
        accountId: 'acc-learner',
        type: 'booking_payment',
        amountCredits: 25,
        direction: 'debit',
        occurredAt: validOccurredAt,
        // ADR-035: required on the wire; this fixture is about another rule.
        actorId: SYSTEM_ACTOR_ID,
        bookingId: 'bk-123',
      });
      expect(payment.type).toBe('booking_payment');
      expect(payment.direction).toBe('debit');
      expect(payment.bookingId).toBe('bk-123');

      // booking_payment with direction credit is rejected
      expect(() =>
        walletTransactionCompletedEventSchema.parse({
          transactionId: 'tx-001',
          accountId: 'acc-learner',
          type: 'booking_payment',
          amountCredits: 25,
          direction: 'credit',
          occurredAt: validOccurredAt,
          // ADR-035: required on the wire; this fixture is about another rule.
          actorId: SYSTEM_ACTOR_ID,
          bookingId: 'bk-123',
        }),
      ).toThrow(/booking_payment must have direction debit/);

      // Successful booking_refund must have direction credit
      const refund = walletTransactionCompletedEventSchema.parse({
        transactionId: 'tx-002',
        accountId: 'acc-learner',
        type: 'booking_refund',
        amountCredits: 25,
        direction: 'credit',
        occurredAt: validOccurredAt,
        // ADR-035: required on the wire; this fixture is about another rule.
        actorId: SYSTEM_ACTOR_ID,
        bookingId: 'bk-123',
      });
      expect(refund.type).toBe('booking_refund');
      expect(refund.direction).toBe('credit');
      expect(refund.bookingId).toBe('bk-123');

      // booking_refund with direction debit is rejected
      expect(() =>
        walletTransactionCompletedEventSchema.parse({
          transactionId: 'tx-002',
          accountId: 'acc-learner',
          type: 'booking_refund',
          amountCredits: 25,
          direction: 'debit',
          occurredAt: validOccurredAt,
          // ADR-035: required on the wire; this fixture is about another rule.
          actorId: SYSTEM_ACTOR_ID,
          bookingId: 'bk-123',
        }),
      ).toThrow(/booking_refund must have direction credit/);
    });

    it('missingbookingIddenied: denies booking_payment and booking_refund when bookingId is missing or empty', () => {
      // booking_payment missing bookingId
      expect(() =>
        walletTransactionCompletedEventSchema.parse({
          transactionId: 'tx-001',
          accountId: 'acc-learner',
          type: 'booking_payment',
          amountCredits: 25,
          direction: 'debit',
          occurredAt: validOccurredAt,
          // ADR-035: required on the wire; this fixture is about another rule.
          actorId: SYSTEM_ACTOR_ID,
        }),
      ).toThrow(/bookingId is required and non-empty for booking_payment/);

      // booking_payment with empty bookingId
      expect(() =>
        walletTransactionCompletedEventSchema.parse({
          transactionId: 'tx-001',
          accountId: 'acc-learner',
          type: 'booking_payment',
          amountCredits: 25,
          direction: 'debit',
          occurredAt: validOccurredAt,
          // ADR-035: required on the wire; this fixture is about another rule.
          actorId: SYSTEM_ACTOR_ID,
          bookingId: '',
        }),
      ).toThrow();

      // booking_payment with whitespace bookingId
      expect(() =>
        walletTransactionCompletedEventSchema.parse({
          transactionId: 'tx-001',
          accountId: 'acc-learner',
          type: 'booking_payment',
          amountCredits: 25,
          direction: 'debit',
          occurredAt: validOccurredAt,
          // ADR-035: required on the wire; this fixture is about another rule.
          actorId: SYSTEM_ACTOR_ID,
          bookingId: '   ',
        }),
      ).toThrow(/bookingId is required and non-empty for booking_payment/);

      // booking_refund missing bookingId
      expect(() =>
        walletTransactionCompletedEventSchema.parse({
          transactionId: 'tx-002',
          accountId: 'acc-learner',
          type: 'booking_refund',
          amountCredits: 25,
          direction: 'credit',
          occurredAt: validOccurredAt,
          // ADR-035: required on the wire; this fixture is about another rule.
          actorId: SYSTEM_ACTOR_ID,
        }),
      ).toThrow(/bookingId is required and non-empty for booking_refund/);

      // booking_refund with empty bookingId
      expect(() =>
        walletTransactionCompletedEventSchema.parse({
          transactionId: 'tx-002',
          accountId: 'acc-learner',
          type: 'booking_refund',
          amountCredits: 25,
          direction: 'credit',
          occurredAt: validOccurredAt,
          // ADR-035: required on the wire; this fixture is about another rule.
          actorId: SYSTEM_ACTOR_ID,
          bookingId: '',
        }),
      ).toThrow();

      // booking_refund with whitespace bookingId
      expect(() =>
        walletTransactionCompletedEventSchema.parse({
          transactionId: 'tx-002',
          accountId: 'acc-learner',
          type: 'booking_refund',
          amountCredits: 25,
          direction: 'credit',
          occurredAt: validOccurredAt,
          // ADR-035: required on the wire; this fixture is about another rule.
          actorId: SYSTEM_ACTOR_ID,
          bookingId: '   ',
        }),
      ).toThrow(/bookingId is required and non-empty for booking_refund/);
    });

    it('nonbookingtopupvalid: accepts non-booking top_up, income_release, and platform_fee with or without bookingId', () => {
      // top_up without bookingId
      const topUp = walletTransactionCompletedEventSchema.parse({
        transactionId: 'tx-100',
        accountId: 'acc-user',
        type: 'top_up',
        amountCredits: 100,
        direction: 'credit',
        occurredAt: validOccurredAt,
        // ADR-035: required on the wire; this fixture is about another rule.
        actorId: SYSTEM_ACTOR_ID,
      });
      expect(topUp.type).toBe('top_up');
      expect(topUp.bookingId).toBeUndefined();

      // top_up with optional bookingId
      const topUpWithBooking = walletTransactionCompletedEventSchema.parse({
        transactionId: 'tx-101',
        accountId: 'acc-user',
        type: 'top_up',
        amountCredits: 100,
        direction: 'credit',
        occurredAt: validOccurredAt,
        // ADR-035: required on the wire; this fixture is about another rule.
        actorId: SYSTEM_ACTOR_ID,
        bookingId: 'bk-optional',
      });
      expect(topUpWithBooking.bookingId).toBe('bk-optional');

      // income_release without bookingId
      const income = walletTransactionCompletedEventSchema.parse({
        transactionId: 'tx-102',
        accountId: 'acc-teacher',
        type: 'income_release',
        amountCredits: 90,
        direction: 'credit',
        occurredAt: validOccurredAt,
        // ADR-035: required on the wire; this fixture is about another rule.
        actorId: SYSTEM_ACTOR_ID,
      });
      expect(income.type).toBe('income_release');

      // platform_fee without bookingId
      const fee = walletTransactionCompletedEventSchema.parse({
        transactionId: 'tx-103',
        accountId: 'acc-platform',
        type: 'platform_fee',
        amountCredits: 10,
        direction: 'credit',
        occurredAt: validOccurredAt,
        // ADR-035: required on the wire; this fixture is about another rule.
        actorId: SYSTEM_ACTOR_ID,
      });
      expect(fee.type).toBe('platform_fee');
    });

    it('positiveinteger/nozero/no floats: enforces positive integer credits on wallet transactions', () => {
      const base = {
        transactionId: 'tx-001',
        accountId: 'acc-user',
        type: 'top_up',
        direction: 'credit' as const,
        occurredAt: validOccurredAt,
        // ADR-035: required on the wire; these fixtures test other rules.
        actorId: SYSTEM_ACTOR_ID,
      };

      // Zero credits rejected
      expect(() =>
        walletTransactionCompletedEventSchema.parse({ ...base, amountCredits: 0 }),
      ).toThrow();

      // Negative credits rejected
      expect(() =>
        walletTransactionCompletedEventSchema.parse({ ...base, amountCredits: -50 }),
      ).toThrow();

      // Float credits rejected
      expect(() =>
        walletTransactionCompletedEventSchema.parse({ ...base, amountCredits: 100.25 }),
      ).toThrow();

      // Positive integer accepted
      const valid = walletTransactionCompletedEventSchema.parse({ ...base, amountCredits: 1000 });
      expect(valid.amountCredits).toBe(1000);
    });

    it('noinventedkind,status semantics: rejects invented types and excludes status or user info', () => {
      const base = {
        transactionId: 'tx-001',
        accountId: 'acc-user',
        amountCredits: 100,
        direction: 'credit' as const,
        occurredAt: validOccurredAt,
        // ADR-035: required on the wire; these fixtures test other rules.
        actorId: SYSTEM_ACTOR_ID,
      };

      // Invented / unapproved event kinds are rejected
      expect(() =>
        walletTransactionCompletedEventSchema.parse({ ...base, type: 'payment_failed' }),
      ).toThrow();
      expect(() =>
        walletTransactionCompletedEventSchema.parse({ ...base, type: 'topup_failed' }),
      ).toThrow();
      expect(() =>
        walletTransactionCompletedEventSchema.parse({ ...base, type: 'booking_cancelled' }),
      ).toThrow();
      expect(() =>
        walletTransactionCompletedEventSchema.parse({ ...base, type: 'status_failed' }),
      ).toThrow();
      expect(() =>
        walletTransactionCompletedEventSchema.parse({ ...base, type: 'transfer' }),
      ).toThrow();

      // Completed family does not expose status semantics or user info (email/tokens)
      const parsedWithExtra = walletTransactionCompletedEventSchema.parse({
        ...base,
        type: 'top_up',
        status: 'failed' as never,
        email: 'user@domain.com' as never,
        token: 'secret-token' as never,
      });
      expect(parsedWithExtra).not.toHaveProperty('status');
      expect(parsedWithExtra).not.toHaveProperty('email');
      expect(parsedWithExtra).not.toHaveProperty('token');
    });

    it('requires valid ISO offset timestamp in occurredAt', () => {
      const base = {
        transactionId: 'tx-001',
        accountId: 'acc-user',
        type: 'top_up',
        amountCredits: 100,
        direction: 'credit' as const,
        // ADR-035: required on the wire; this fixture is about occurredAt.
        actorId: SYSTEM_ACTOR_ID,
      };

      // Valid UTC ISO string accepted
      expect(
        walletTransactionCompletedEventSchema.parse({
          ...base,
          occurredAt: '2026-10-12T03:00:00.000Z',
        }).occurredAt,
      ).toBe('2026-10-12T03:00:00.000Z');

      // Valid offset string accepted
      expect(
        walletTransactionCompletedEventSchema.parse({
          ...base,
          occurredAt: '2026-10-12T10:00:00.000+07:00',
        }).occurredAt,
      ).toBe('2026-10-12T10:00:00.000+07:00');

      // Non-offset datetime rejected
      expect(() =>
        walletTransactionCompletedEventSchema.parse({
          ...base,
          occurredAt: '2026-10-12T10:00:00',
        }),
      ).toThrow();

      // Non-date string rejected
      expect(() =>
        walletTransactionCompletedEventSchema.parse({
          ...base,
          occurredAt: 'yesterday',
        }),
      ).toThrow();
    });
  });
});
