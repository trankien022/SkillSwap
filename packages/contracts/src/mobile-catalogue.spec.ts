import {
  decodeSkillCursor,
  encodeSkillCursor,
  isValidSkillCursor,
  listSkillsQuerySchema,
  skillCatalogueItemSchema,
  skillCatalogueLevelSchema,
  skillCataloguePageSchema,
  SKILL_CURSOR_MAX_LENGTH,
} from './mobile-catalogue';

describe('mobile-catalogue contracts (portable cursor codec)', () => {
  describe('Buffer-free environment compatibility', () => {
    it('encodes and decodes when Buffer is completely undefined', () => {
      const originalBuffer = (globalThis as unknown as { Buffer?: unknown }).Buffer;
      try {
        (globalThis as unknown as { Buffer?: unknown }).Buffer = undefined;

        const tuple: [string, string, string] = [
          'Mobile Development 📱',
          'Expo & React Native ⚛️',
          '99999999-9999-4999-8999-999999999999',
        ];
        const encoded = encodeSkillCursor(tuple);
        expect(typeof encoded).toBe('string');
        expect(encoded).not.toContain('+');
        expect(encoded).not.toContain('/');
        expect(encoded).not.toContain('=');

        const decoded = decodeSkillCursor(encoded);
        expect(decoded).toEqual(tuple);
      } finally {
        (globalThis as unknown as { Buffer?: unknown }).Buffer = originalBuffer;
      }
    });
  });

  describe('Vietnamese, emojis, and delimiters round-trip', () => {
    it('preserves Vietnamese text with accents and combining characters', () => {
      const tuple: [string, string, string] = [
        'Công nghệ thông tin 🇻🇳',
        'Lập trình viên chuyên nghiệp (Thực chiến)',
        '11111111-1111-4111-8111-111111111111',
      ];
      const encoded = encodeSkillCursor(tuple);
      expect(decodeSkillCursor(encoded)).toEqual(tuple);
    });

    it('preserves complex emojis and delimiters (| & #) without corruption', () => {
      const tuple: [string, string, string] = [
        'Cloud & DevOps ☁️ | CI/CD Pipelines',
        'Kubernetes ☸️ | Docker 🐳 & C++ / C#',
        '22222222-2222-4222-8222-222222222222',
      ];
      const encoded = encodeSkillCursor(tuple);
      expect(decodeSkillCursor(encoded)).toEqual(tuple);
    });
  });

  describe('Malformed UTF-8 rejection', () => {
    it('rejects base64url payload containing invalid UTF-8 byte sequences', () => {
      // 0xFF 0xFF is invalid UTF-8; in base64 it is //8=, in base64url it is __8
      const invalidUtf8Cursor = '__8';
      expect(isValidSkillCursor(invalidUtf8Cursor)).toBe(false);
      expect(() => decodeSkillCursor(invalidUtf8Cursor)).toThrow(/Malformed UTF-8/);
    });

    it('round-trips lone surrogate code units escaped by JSON serialization', () => {
      const loneSurrogateTuple: [string, string, string] = [
        'Category',
        'Name \uD800',
        '33333333-3333-4333-8333-333333333333',
      ];
      expect(decodeSkillCursor(encodeSkillCursor(loneSurrogateTuple))).toEqual(loneSurrogateTuple);
    });
  });

  describe('Non-canonical encoding and padding rejection', () => {
    it('rejects explicit base64 padding (=) in incoming cursor', () => {
      const valid = encodeSkillCursor(['Cat', 'Name', 'sk-1']);
      const padded = valid + '=';
      expect(isValidSkillCursor(padded)).toBe(false);
      expect(() => decodeSkillCursor(padded)).toThrow();
    });

    it('rejects standard base64 characters (+ and /)', () => {
      expect(isValidSkillCursor('abc+def')).toBe(false);
      expect(isValidSkillCursor('abc/def')).toBe(false);
      expect(() => decodeSkillCursor('abc+def')).toThrow();
    });

    it('rejects non-canonical whitespace in JSON', () => {
      // Valid JSON but with spaces inside, e.g. ["A", "B", "C"]
      const jsonWithSpaces = '["A", "B", "sk-1"]';
      let b64 = '';
      for (let i = 0; i < jsonWithSpaces.length; i++) {
        b64 += String.fromCharCode(jsonWithSpaces.charCodeAt(i));
      }
      const rawBase64Url = globalThis
        .btoa(b64)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      expect(isValidSkillCursor(rawBase64Url)).toBe(false);
      expect(() => decodeSkillCursor(rawBase64Url)).toThrow(/canonically encoded/);
    });
  });

  describe('Bounded size and shape validation', () => {
    it('rejects cursor exceeding max length limit', () => {
      const hugeCursor = 'a'.repeat(SKILL_CURSOR_MAX_LENGTH + 1);
      expect(isValidSkillCursor(hugeCursor)).toBe(false);
      expect(() => decodeSkillCursor(hugeCursor)).toThrow(/bounded size limit/);
    });

    it('rejects cursor with invalid base64url length (% 4 === 1)', () => {
      // A base64 string cannot have length % 4 === 1 (e.g. 5 chars)
      const invalidLengthCursor = 'abcde';
      expect(isValidSkillCursor(invalidLengthCursor)).toBe(false);
      expect(() => decodeSkillCursor(invalidLengthCursor)).toThrow();
    });

    it('rejects non-array JSON payload', () => {
      const json = JSON.stringify({ category: 'A', name: 'B', id: 'sk-1' });
      const b64 = globalThis.btoa(json).replace(/=+$/, '');
      expect(isValidSkillCursor(b64)).toBe(false);
      expect(() => decodeSkillCursor(b64)).toThrow(/3-element tuple/);
    });

    it('rejects tuple of wrong length (2 or 4 elements)', () => {
      const two = globalThis.btoa(JSON.stringify(['A', 'B'])).replace(/=+$/, '');
      expect(isValidSkillCursor(two)).toBe(false);

      const four = globalThis.btoa(JSON.stringify(['A', 'B', 'C', 'D'])).replace(/=+$/, '');
      expect(isValidSkillCursor(four)).toBe(false);
    });

    it('rejects tuple containing non-string or whitespace-only elements', () => {
      const nonString = globalThis.btoa(JSON.stringify(['A', 123, 'sk-1'])).replace(/=+$/, '');
      expect(isValidSkillCursor(nonString)).toBe(false);

      const emptyElement = globalThis.btoa(JSON.stringify(['A', '   ', 'sk-1'])).replace(/=+$/, '');
      expect(isValidSkillCursor(emptyElement)).toBe(false);
    });
  });

  describe('listSkillsQuerySchema', () => {
    it('defaults limit to 50 and accepts valid portable cursor', () => {
      const cursor = encodeSkillCursor(['Technology', 'TypeScript', 'sk-123']);
      const parsed = listSkillsQuerySchema.parse({
        q: 'Type',
        cursor,
      });
      expect(parsed).toEqual({
        limit: 50,
        q: 'Type',
        cursor,
      });
    });

    it('keeps `keyword` as a deprecated alias and caps the page at 100', () => {
      expect(listSkillsQuerySchema.parse({ keyword: 'Type' }).keyword).toBe('Type');
      expect(listSkillsQuerySchema.parse({ limit: 100 }).limit).toBe(100);
      expect(() => listSkillsQuerySchema.parse({ limit: 101 })).toThrow();
    });

    it('rejects malformed or padded cursor with validation error', () => {
      expect(() => listSkillsQuerySchema.parse({ cursor: 'invalid!cursor' })).toThrow();
      expect(() => listSkillsQuerySchema.parse({ cursor: 'validBase64WithPadding==' })).toThrow();
    });

    it('rejects oversize cursor in schema', () => {
      expect(() => listSkillsQuerySchema.parse({ cursor: 'x'.repeat(513) })).toThrow();
    });
  });

  describe('skillCatalogueItemSchema and skillCataloguePageSchema', () => {
    it('requires explicit levels (no silent default fabrication)', () => {
      expect(() =>
        skillCatalogueItemSchema.parse({
          id: 'sk-1',
          name: 'React',
          category: 'Tech',
        }),
      ).toThrow();

      const valid = {
        id: 'sk-1',
        name: 'React',
        category: 'Tech',
        levels: skillCatalogueLevelSchema.options,
      };
      expect(skillCatalogueItemSchema.parse(valid)).toEqual(valid);
    });

    it('round-trips page schema with portable nextCursor', () => {
      const nextCursor = encodeSkillCursor(['Tech', 'React', 'sk-1']);
      const page = {
        items: [
          {
            id: 'sk-1',
            name: 'React',
            category: 'Tech',
            levels: ['beginner', 'intermediate', 'advanced', 'expert'] as const,
          },
        ],
        nextCursor,
      };
      expect(skillCataloguePageSchema.parse(page)).toEqual(page);
    });
  });
});
