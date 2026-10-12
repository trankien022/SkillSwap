import {
  decodeBookingCursor,
  encodeBookingCursor,
  isValidBookingCursor,
  learnerBookingClassSummarySchema,
  learnerBookingItemSchema,
  myBookingsPageSchema,
  myBookingsQuerySchema,
} from './mobile-my-bookings';

describe('mobile-my-bookings contracts', () => {
  describe('cursor helpers', () => {
    it('encodes and decodes valid [startsAtISO, bookingId] tuple canonically', () => {
      const tuple: [string, string] = ['2026-10-15T10:00:00.000Z', 'bk-uuid-1'];
      const encoded = encodeBookingCursor(tuple);
      expect(typeof encoded).toBe('string');
      expect(isValidBookingCursor(encoded)).toBe(true);

      const decoded = decodeBookingCursor(encoded);
      expect(decoded).toEqual(tuple);
    });

    it('rejects malformed or non-canonical booking cursors', () => {
      expect(isValidBookingCursor('not-base64url!@#')).toBe(false);
      expect(isValidBookingCursor('')).toBe(false);
      expect(isValidBookingCursor(12345)).toBe(false);
      expect(isValidBookingCursor(null)).toBe(false);
    });
  });

  describe('myBookingsQuerySchema', () => {
    it('applies defaults: limit=20, state and upcoming omitted', () => {
      const parsed = myBookingsQuerySchema.parse({});
      expect(parsed).toEqual({
        limit: 20,
        state: undefined,
        upcoming: undefined,
        cursor: undefined,
      });
    });

    it('parses explicit upcoming="true" string to boolean true', () => {
      const parsed = myBookingsQuerySchema.parse({ upcoming: 'true' });
      expect(parsed.upcoming).toBe(true);
      expect(parsed.limit).toBe(20);
    });

    it('parses explicit upcoming="false" string to boolean false', () => {
      const parsed = myBookingsQuerySchema.parse({ upcoming: 'false' });
      expect(parsed.upcoming).toBe(false);
      expect(parsed.limit).toBe(20);
    });

    it('rejects invalid upcoming values other than "true" or "false"', () => {
      expect(() => myBookingsQuerySchema.parse({ upcoming: 'yes' })).toThrow();
      expect(() => myBookingsQuerySchema.parse({ upcoming: '1' })).toThrow();
      expect(() => myBookingsQuerySchema.parse({ upcoming: '0' })).toThrow();
      expect(() => myBookingsQuerySchema.parse({ upcoming: 'null' })).toThrow();
    });

    it('accepts the 5 domain booking states', () => {
      const states = ['pending', 'confirmed', 'completed', 'cancelled', 'disputed'] as const;
      for (const st of states) {
        const parsed = myBookingsQuerySchema.parse({ state: st });
        expect(parsed.state).toBe(st);
      }
    });

    it('rejects unknown booking states', () => {
      expect(() => myBookingsQuerySchema.parse({ state: 'active' })).toThrow();
      expect(() => myBookingsQuerySchema.parse({ state: 'expired' })).toThrow();
    });

    it('coerces string limit and bounds to 1..50', () => {
      expect(myBookingsQuerySchema.parse({ limit: '10' }).limit).toBe(10);
      expect(myBookingsQuerySchema.parse({ limit: 1 }).limit).toBe(1);
      expect(myBookingsQuerySchema.parse({ limit: 50 }).limit).toBe(50);

      expect(() => myBookingsQuerySchema.parse({ limit: 0 })).toThrow();
      expect(() => myBookingsQuerySchema.parse({ limit: 51 })).toThrow();
      expect(() => myBookingsQuerySchema.parse({ limit: -5 })).toThrow();
    });

    it('accepts valid cursor and rejects malformed cursor', () => {
      const validCursor = encodeBookingCursor(['2026-10-15T10:00:00.000Z', 'bk-123']);
      expect(myBookingsQuerySchema.parse({ cursor: validCursor }).cursor).toBe(validCursor);

      expect(() => myBookingsQuerySchema.parse({ cursor: 'invalid_cursor' })).toThrow();
    });

    it('ignores client attempts to inject learnerId or callerId in query schema', () => {
      const parsed = myBookingsQuerySchema.parse({
        learnerId: 'attacker-id',
        callerId: 'victim-id',
      } as Record<string, unknown>);
      expect((parsed as Record<string, unknown>).learnerId).toBeUndefined();
      expect((parsed as Record<string, unknown>).callerId).toBeUndefined();
    });
  });

  describe('learnerBookingItemSchema', () => {
    const validSummary = {
      description: 'System Architecture Fundamentals',
      skillIds: ['sk-arch-1', 'sk-node-1'],
      startsAt: '2026-10-20T14:00:00.000Z',
      durationMinutes: 90,
      teacherId: 'teacher-uuid-1',
      teacherDisplayName: 'Prof. Alan Turing',
      classState: 'published' as const,
    };

    const validItem = {
      bookingId: 'bk-uuid-1',
      classId: 'cls-uuid-1',
      state: 'confirmed' as const,
      priceCredits: 100,
      createdAt: '2026-10-12T08:00:00.000Z',
      expiresAt: null,
      classSummary: validSummary,
      roomAccessEligible: true,
      ratingEligible: false,
      hasRated: false,
    };

    it('validates a confirmed booking item', () => {
      expect(learnerBookingItemSchema.parse(validItem)).toEqual(validItem);
    });

    it('validates a pending booking item with non-null ISO expiresAt', () => {
      const pendingItem = {
        ...validItem,
        state: 'pending' as const,
        expiresAt: '2026-10-12T08:15:00.000Z',
        roomAccessEligible: false,
      };
      expect(learnerBookingItemSchema.parse(pendingItem)).toEqual(pendingItem);
    });

    it('rejects item with non-positive priceCredits or invalid state', () => {
      expect(() =>
        learnerBookingItemSchema.parse({
          ...validItem,
          priceCredits: 0,
        }),
      ).toThrow();

      expect(() =>
        learnerBookingItemSchema.parse({
          ...validItem,
          state: 'invalid-state',
        }),
      ).toThrow();
    });

    it('validates class summary schema independently', () => {
      expect(learnerBookingClassSummarySchema.parse(validSummary)).toEqual(validSummary);
      expect(() =>
        learnerBookingClassSummarySchema.parse({
          ...validSummary,
          durationMinutes: 'ninety',
        }),
      ).toThrow();
    });
  });

  describe('myBookingsPageSchema', () => {
    it('validates page with items, nextCursor, and exact totalUpcomingCount', () => {
      const page = {
        items: [],
        nextCursor: 'valid_cursor_string',
        totalUpcomingCount: 5,
      };
      expect(myBookingsPageSchema.parse(page)).toEqual(page);
    });

    it('validates page with nextCursor: null', () => {
      const page = {
        items: [],
        nextCursor: null,
        totalUpcomingCount: 0,
      };
      expect(myBookingsPageSchema.parse(page)).toEqual(page);
    });

    it('rejects negative totalUpcomingCount', () => {
      expect(() =>
        myBookingsPageSchema.parse({
          items: [],
          nextCursor: null,
          totalUpcomingCount: -1,
        }),
      ).toThrow();
    });
  });
});
