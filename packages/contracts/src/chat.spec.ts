import {
  CHAT_BODY_MAX_LENGTH,
  chatMessagesPageSchema,
  chatMessageSchema,
  chatSenderRoleSchema,
  postChatMessageSchema,
} from './chat';

const ID = '7c1e0000-0000-4000-8000-0000000000aa';
const CLASS_ID = '7c1e0000-0000-4000-8000-0000000000bb';
const BOOKING_ID = '7c1e0000-0000-4000-8000-0000000000cc';
const TEACHER = '7c1e0000-0000-4000-8000-0000000000dd';

function message(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: ID,
    classId: CLASS_ID,
    bookingId: BOOKING_ID,
    senderId: TEACHER,
    senderRole: 'teacher',
    body: 'Bài 3, trang 45 — xem lại phần đạo hàm.',
    createdAt: '2026-10-26T10:00:00.000Z',
    ...overrides,
  };
}

describe('FR-012 in-class chat contract (ADR-036 Amendment A)', () => {
  describe('message body', () => {
    it('trims surrounding whitespace rather than storing it', () => {
      // A body is echoed to every participant; leading and trailing spaces are noise that two
      // visually identical messages would then differ by.
      expect(postChatMessageSchema.parse({ body: '  xin chào  ' }).body).toBe('xin chào');
    });

    it('keeps newlines and tabs, which are how people write a list', () => {
      const body = 'Dòng 1\nDòng 2\t- ý phụ';
      expect(postChatMessageSchema.parse({ body }).body).toBe(body);
    });

    it('refuses an empty or whitespace-only message', () => {
      expect(() => postChatMessageSchema.parse({ body: '' })).toThrow();
      expect(() => postChatMessageSchema.parse({ body: '   \n\t ' })).toThrow();
    });

    it('measures the length after trimming, so padding cannot smuggle a long message past', () => {
      const atLimit = 'a'.repeat(CHAT_BODY_MAX_LENGTH);
      expect(postChatMessageSchema.parse({ body: `  ${atLimit}  ` }).body).toBe(atLimit);
      expect(() => postChatMessageSchema.parse({ body: 'a'.repeat(CHAT_BODY_MAX_LENGTH + 1) })).toThrow();
    });

    it('refuses control characters that would corrupt a stored or rendered body', () => {
      for (const bad of ['a\u0000b', 'a\u0007b', 'a\u001bb', 'a\u007fb']) {
        expect(() => postChatMessageSchema.parse({ body: bad })).toThrow();
      }
    });

    it('never echoes the rejected body in the error', () => {
      // NFR-004/NFR-008: a rejected message is still something a person typed and may have
      // assumed was private. It must not travel out through a validation error message.
      const secret = '0912345678-gọi-tôi';
      const long = `${secret}${'x'.repeat(CHAT_BODY_MAX_LENGTH)}`;
      let messages = '';
      try {
        postChatMessageSchema.parse({ body: long });
      } catch (error) {
        messages = JSON.stringify(error);
      }
      expect(messages).not.toContain('0912345678');
      expect(messages).not.toContain('gọi-tôi');
      expect(messages.length).toBeGreaterThan(0);
    });

    it('stores contact information like any other text', () => {
      // BR-056 was withdrawn (ADR-036 Amendment A): there is no content rule, so this must parse.
      for (const body of ['0901234567', 'minh@example.com', 'www.facebook.com/minh', 'zalo: minh']) {
        expect(postChatMessageSchema.parse({ body }).body).toBe(body);
      }
    });

    it('refuses a non-string body with a message that does not quote it', () => {
      let messages = '';
      try {
        postChatMessageSchema.parse({ body: 42 });
      } catch (error) {
        messages = JSON.stringify(error);
      }
      expect(messages).toContain('Message must be text');
      expect(messages).not.toContain('42');
    });
  });

  describe('message view', () => {
    it('has no flagged field, because nothing flags a message', () => {
      const parsed = chatMessageSchema.parse(message());
      expect(parsed).not.toHaveProperty('flagged');
    });

    it('round-trips through JSON, because it crosses HTTP', () => {
      const parsed = chatMessageSchema.parse(message());
      expect(chatMessageSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
    });

    it('requires uuid identifiers, because they are written into uuid columns', () => {
      expect(() => chatMessageSchema.parse(message({ id: 'msg-1' }))).toThrow();
      expect(() => chatMessageSchema.parse(message({ classId: 'class-1' }))).toThrow();
      expect(() => chatMessageSchema.parse(message({ bookingId: 'booking-1' }))).toThrow();
      expect(() => chatMessageSchema.parse(message({ senderId: 'teacher' }))).toThrow();
    });

    it('refuses a sender role outside the booking relationship', () => {
      expect(chatSenderRoleSchema.options).toEqual(['learner', 'teacher']);
      expect(() => chatMessageSchema.parse(message({ senderRole: 'admin' }))).toThrow();
    });

    it('refuses a timestamp without an offset, which is ambiguous across zones', () => {
      expect(() =>
        chatMessageSchema.parse(message({ createdAt: '2026-10-26T10:00:00' })),
      ).toThrow();
    });
  });

  describe('page (NFR-014)', () => {
    it('carries items and the full page metadata', () => {
      const parsed = chatMessagesPageSchema.parse({
        items: [message()],
        page: { limit: 20, nextCursor: null, total: 1 },
      });
      expect(parsed.items).toHaveLength(1);
      expect(parsed.page).toEqual({ limit: 20, nextCursor: null, total: 1 });
    });

    it('refuses a page missing its metadata, so a client never guesses whether more exist', () => {
      expect(() => chatMessagesPageSchema.parse({ items: [message()] })).toThrow();
    });

    it('accepts an empty thread', () => {
      const parsed = chatMessagesPageSchema.parse({
        items: [],
        page: { limit: 20, nextCursor: null, total: 0 },
      });
      expect(parsed.items).toEqual([]);
    });
  });
});
