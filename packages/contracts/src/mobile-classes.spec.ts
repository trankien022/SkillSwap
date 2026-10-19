import {
  decodeClassCursor,
  encodeClassCursor,
  isValidClassCursor,
  listClassesPageSchema,
  listClassesQuerySchema,
  classListItemSchema,
  CLASS_CURSOR_MAX_LENGTH,
} from './mobile-classes';
import { resolveSearchTerm } from './pagination';

describe('mobile-classes contracts (portable cursor codec & schemas)', () => {
  describe('Buffer-free environment compatibility', () => {
    it('encodes and decodes when Buffer is completely undefined', () => {
      const originalBuffer = (globalThis as unknown as { Buffer?: unknown }).Buffer;
      try {
        (globalThis as unknown as { Buffer?: unknown }).Buffer = undefined;

        const tuple: [string, string] = [
          '2026-10-15T10:00:00.000Z',
          '99999999-9999-4999-8999-999999999999',
        ];
        const encoded = encodeClassCursor(tuple);
        expect(typeof encoded).toBe('string');
        expect(encoded).not.toContain('+');
        expect(encoded).not.toContain('/');
        expect(encoded).not.toContain('=');

        const decoded = decodeClassCursor(encoded);
        expect(decoded).toEqual(tuple);
      } finally {
        (globalThis as unknown as { Buffer?: unknown }).Buffer = originalBuffer;
      }
    });
  });

  describe('Date ties and UUID round-trip', () => {
    it('preserves ISO date strings and UUIDs', () => {
      const tuple: [string, string] = [
        '2026-11-01T08:30:00.000Z',
        '11111111-1111-4111-8111-111111111111',
      ];
      const encoded = encodeClassCursor(tuple);
      expect(decodeClassCursor(encoded)).toEqual(tuple);
      expect(isValidClassCursor(encoded)).toBe(true);
    });
  });

  describe('Malformed UTF-8 and invalid date rejection', () => {
    it('rejects base64url payload containing invalid UTF-8 byte sequences', () => {
      const invalidUtf8Cursor = '__8';
      expect(isValidClassCursor(invalidUtf8Cursor)).toBe(false);
      expect(() => decodeClassCursor(invalidUtf8Cursor)).toThrow(/Malformed UTF-8/);
    });

    it('rejects cursor with invalid date string in startsAt', () => {
      const json = JSON.stringify(['not-a-date', 'cls-123']);
      const b64 = globalThis.btoa(json).replace(/=+$/, '');
      expect(isValidClassCursor(b64)).toBe(false);
      expect(() => decodeClassCursor(b64)).toThrow(/valid date string/);
    });
  });

  describe('Non-canonical encoding and padding rejection', () => {
    it('rejects explicit base64 padding (=) in incoming cursor', () => {
      const valid = encodeClassCursor(['2026-10-15T10:00:00.000Z', 'cls-1']);
      const padded = valid + '=';
      expect(isValidClassCursor(padded)).toBe(false);
      expect(() => decodeClassCursor(padded)).toThrow();
    });

    it('rejects standard base64 characters (+ and /)', () => {
      expect(isValidClassCursor('abc+def')).toBe(false);
      expect(isValidClassCursor('abc/def')).toBe(false);
      expect(() => decodeClassCursor('abc+def')).toThrow();
    });

    it('rejects non-canonical whitespace in JSON', () => {
      const jsonWithSpaces = '["2026-10-15T10:00:00.000Z", "cls-1"]';
      let b64 = '';
      for (let i = 0; i < jsonWithSpaces.length; i++) {
        b64 += String.fromCharCode(jsonWithSpaces.charCodeAt(i));
      }
      const rawBase64Url = globalThis
        .btoa(b64)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      expect(isValidClassCursor(rawBase64Url)).toBe(false);
      expect(() => decodeClassCursor(rawBase64Url)).toThrow(/canonically encoded/);
    });
  });

  describe('Bounded size and shape validation', () => {
    it('rejects cursor exceeding max length limit', () => {
      const hugeCursor = 'a'.repeat(CLASS_CURSOR_MAX_LENGTH + 1);
      expect(isValidClassCursor(hugeCursor)).toBe(false);
      expect(() => decodeClassCursor(hugeCursor)).toThrow(/bounded size limit/);
    });

    it('rejects cursor with invalid base64url length (% 4 === 1)', () => {
      const invalidLengthCursor = 'abcde';
      expect(isValidClassCursor(invalidLengthCursor)).toBe(false);
      expect(() => decodeClassCursor(invalidLengthCursor)).toThrow();
    });

    it('rejects tuple of wrong length (1 or 3 elements)', () => {
      const one = globalThis.btoa(JSON.stringify(['2026-10-15T10:00:00.000Z'])).replace(/=+$/, '');
      expect(isValidClassCursor(one)).toBe(false);

      const three = globalThis
        .btoa(JSON.stringify(['2026-10-15T10:00:00.000Z', 'cls-1', 'extra']))
        .replace(/=+$/, '');
      expect(isValidClassCursor(three)).toBe(false);
    });

    it('rejects tuple containing non-string or whitespace-only elements', () => {
      const nonString = globalThis
        .btoa(JSON.stringify(['2026-10-15T10:00:00.000Z', 123]))
        .replace(/=+$/, '');
      expect(isValidClassCursor(nonString)).toBe(false);

      const emptyElement = globalThis
        .btoa(JSON.stringify(['2026-10-15T10:00:00.000Z', '   ']))
        .replace(/=+$/, '');
      expect(isValidClassCursor(emptyElement)).toBe(false);
    });
  });

  describe('listClassesQuerySchema', () => {
    it('defaults limit to 20 and accepts valid parameters', () => {
      const cursor = encodeClassCursor(['2026-10-15T10:00:00.000Z', 'cls-123']);
      const parsed = listClassesQuerySchema.parse({
        q: 'Guitar',
        skillId: 'sk-1',
        teacherId: 'me',
        state: 'published',
        cursor,
      });
      expect(parsed).toEqual({
        limit: 20,
        q: 'Guitar',
        skillId: 'sk-1',
        teacherId: 'me',
        state: 'published',
        cursor,
      });
    });

    it('accepts the deprecated `keyword` alias and prefers `q` through resolveSearchTerm', () => {
      expect(listClassesQuerySchema.parse({ keyword: 'Guitar' }).keyword).toBe('Guitar');
      expect(resolveSearchTerm({ q: 'piano', keyword: 'Guitar' })).toBe('piano');
      expect(resolveSearchTerm({ keyword: '  Guitar  ' })).toBe('Guitar');
      expect(resolveSearchTerm({})).toBeUndefined();
    });

    it('validates startDate <= endDate', () => {
      const valid = listClassesQuerySchema.parse({
        startDate: '2026-10-15T00:00:00.000Z',
        endDate: '2026-10-16T00:00:00.000Z',
      });
      expect(valid.startDate).toBe('2026-10-15T00:00:00.000Z');

      expect(() =>
        listClassesQuerySchema.parse({
          startDate: '2026-10-16T00:00:00.000Z',
          endDate: '2026-10-15T00:00:00.000Z',
        }),
      ).toThrow(/startDate must be less than or equal to endDate/);
    });

    it('rejects limit > 100 or < 1 (the documented max page size)', () => {
      expect(() => listClassesQuerySchema.parse({ limit: 0 })).toThrow();
      expect(() => listClassesQuerySchema.parse({ limit: 101 })).toThrow();
      expect(listClassesQuerySchema.parse({ limit: 100 }).limit).toBe(100);
    });

    it('rejects malformed cursor in schema', () => {
      expect(() => listClassesQuerySchema.parse({ cursor: 'invalid!cursor' })).toThrow();
    });
  });

  describe('classListItemSchema & listClassesPageSchema', () => {
    it('validates class item view with provisional ratings', () => {
      const item = {
        id: 'cls-1',
        teacherId: 'teacher-1',
        teacherDisplayName: 'Prof. John',
        skillIds: ['sk-1'],
        description: 'Physics 101',
        startsAt: '2026-10-15T10:00:00.000Z',
        durationMinutes: 60,
        priceCredits: 100,
        capacity: 10,
        confirmedBookingsCount: 3,
        availableSeats: 7,
        state: 'published' as const,
        averageRating: null,
        ratingsCount: 0,
      };
      expect(classListItemSchema.parse(item)).toEqual(item);
    });

    it('validates page schema with nextCursor and totalActiveTeachingCount', () => {
      const page = {
        items: [],
        nextCursor: encodeClassCursor(['2026-10-15T10:00:00.000Z', 'cls-1']),
        totalActiveTeachingCount: 4,
      };
      expect(listClassesPageSchema.parse(page)).toEqual(page);
    });
  });
});
