import {
  bookingStateSchema,
  classDetailParamsSchema,
  classDetailRatingItemSchema,
  classDetailTeacherSchema,
  classDetailViewSchema,
  classIdParamSchema,
  ownBookingSummarySchema,
} from './mobile-class-detail';

describe('mobile-class-detail contracts', () => {
  describe('UUID param schemas', () => {
    it('validates a correct UUID v4', () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      expect(classIdParamSchema.parse(validUuid)).toBe(validUuid);
      expect(classDetailParamsSchema.parse({ id: validUuid })).toEqual({ id: validUuid });
    });

    it('rejects invalid or non-UUID strings', () => {
      expect(() => classIdParamSchema.parse('not-a-uuid')).toThrow();
      expect(() => classIdParamSchema.parse('')).toThrow();
      expect(() => classIdParamSchema.parse('123')).toThrow();
      expect(() => classDetailParamsSchema.parse({ id: 'invalid' })).toThrow();
    });
  });

  describe('bookingStateSchema', () => {
    it('accepts the 5 domain booking states', () => {
      const states = ['pending', 'confirmed', 'completed', 'cancelled', 'disputed'];
      for (const st of states) {
        expect(bookingStateSchema.parse(st)).toBe(st);
      }
    });

    it('rejects unknown booking states', () => {
      expect(() => bookingStateSchema.parse('unknown')).toThrow();
      expect(() => bookingStateSchema.parse('rejected')).toThrow();
    });
  });

  describe('classDetailTeacherSchema', () => {
    it('validates teacher summary with provisional null rating', () => {
      const teacher = {
        id: 'teacher-uuid-1',
        displayName: 'Dr. Jane Smith',
        averageRating: null,
        ratingsCount: 0,
      };
      expect(classDetailTeacherSchema.parse(teacher)).toEqual(teacher);
    });

    it('accepts numerical average rating when present', () => {
      const teacher = {
        id: 'teacher-uuid-1',
        displayName: 'Dr. Jane Smith',
        averageRating: 4.8,
        ratingsCount: 15,
      };
      expect(classDetailTeacherSchema.parse(teacher)).toEqual(teacher);
    });

    it('rejects average rating out of 0..5 range', () => {
      expect(() =>
        classDetailTeacherSchema.parse({
          id: 'teacher-1',
          displayName: 'Jane',
          averageRating: 5.5,
          ratingsCount: 1,
        }),
      ).toThrow();
    });
  });

  describe('classDetailRatingItemSchema', () => {
    it('validates rating item with stars 1-5', () => {
      const rating = {
        id: 'rate-1',
        learnerDisplayName: 'Bob',
        stars: 5,
        comment: 'Excellent lecture!',
        createdAt: '2026-10-12T10:00:00.000Z',
      };
      expect(classDetailRatingItemSchema.parse(rating)).toEqual(rating);
    });

    it('rejects invalid star values (0 or 6)', () => {
      const invalidZero = {
        id: 'rate-1',
        learnerDisplayName: 'Bob',
        stars: 0,
        comment: 'Bad',
        createdAt: '2026-10-12T10:00:00.000Z',
      };
      expect(() => classDetailRatingItemSchema.parse(invalidZero)).toThrow();

      const invalidSix = {
        ...invalidZero,
        stars: 6,
      };
      expect(() => classDetailRatingItemSchema.parse(invalidSix)).toThrow();
    });
  });

  describe('ownBookingSummarySchema', () => {
    it('validates booking summary with null or ISO expiresAt', () => {
      const active = {
        bookingId: 'bk-1',
        state: 'pending' as const,
        expiresAt: '2026-10-12T12:15:00.000Z',
      };
      expect(ownBookingSummarySchema.parse(active)).toEqual(active);

      const confirmed = {
        bookingId: 'bk-2',
        state: 'confirmed' as const,
        expiresAt: null,
      };
      expect(ownBookingSummarySchema.parse(confirmed)).toEqual(confirmed);
    });
  });

  describe('classDetailViewSchema', () => {
    const baseClassDetail = {
      id: 'cls-12345678-1234-1234-1234-1234567890ab',
      teacher: {
        id: 'tch-12345678-1234-1234-1234-1234567890ab',
        displayName: 'Prof. Turing',
        averageRating: null,
        ratingsCount: 0,
      },
      skillIds: ['sk-cs-101', 'sk-algo'],
      description: 'Foundations of Computer Science',
      startsAt: '2026-10-15T09:00:00.000Z',
      durationMinutes: 90,
      priceCredits: 50,
      capacity: 25,
      availableSeats: 20,
      state: 'published' as const,
      canBook: true,
      recentRatings: [],
      ownBooking: null,
    };

    it('validates complete class detail view with ownBooking: null and empty recentRatings', () => {
      expect(classDetailViewSchema.parse(baseClassDetail)).toEqual(baseClassDetail);
    });

    it('validates class detail view with active ownBooking', () => {
      const withBooking = {
        ...baseClassDetail,
        canBook: false,
        ownBooking: {
          bookingId: 'bk-999',
          state: 'confirmed' as const,
          expiresAt: null,
        },
      };
      expect(classDetailViewSchema.parse(withBooking)).toEqual(withBooking);
    });

    it('validates when ownBooking is undefined/omitted', () => {
      const { ownBooking: _omitted, ...withoutOwnBooking } = baseClassDetail;
      const parsed = classDetailViewSchema.parse(withoutOwnBooking);
      expect(parsed.id).toBe(baseClassDetail.id);
      expect(parsed.ownBooking).toBeUndefined();
    });

    it('accepts the optional resolved `skills` and treats an absent one as absent', () => {
      const skills = [
        { id: 'sk-cs-101', name: 'Computer science', category: 'Programming', levels: ['beginner'] },
      ];
      const withSkills = { ...baseClassDetail, skills };
      expect(classDetailViewSchema.parse(withSkills).skills).toEqual(skills);
      // Absent, not empty: a failed catalogue read must stay distinguishable.
      expect(classDetailViewSchema.parse(baseClassDetail).skills).toBeUndefined();
    });

    it('rejects a malformed skill entry', () => {
      expect(() =>
        classDetailViewSchema.parse({
          ...baseClassDetail,
          skills: [{ id: 'sk-cs-101', name: '', category: 'Programming', levels: [] }],
        }),
      ).toThrow();
    });

    it('rejects invalid class lifecycle state', () => {
      expect(() =>
        classDetailViewSchema.parse({
          ...baseClassDetail,
          state: 'archived',
        }),
      ).toThrow();
    });

    it('rejects non-positive priceCredits or capacity', () => {
      expect(() =>
        classDetailViewSchema.parse({
          ...baseClassDetail,
          priceCredits: 0,
        }),
      ).toThrow();

      expect(() =>
        classDetailViewSchema.parse({
          ...baseClassDetail,
          capacity: -1,
        }),
      ).toThrow();
    });

    it('rejects non-ISO startsAt', () => {
      expect(() =>
        classDetailViewSchema.parse({
          ...baseClassDetail,
          startsAt: 'not-a-date',
        }),
      ).toThrow();
    });
  });
});
