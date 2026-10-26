import type { DataSource } from 'typeorm';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { SqlChatRepository } from './sql-chat-repository';

const CLASS_ID = '7c1e0000-0000-4000-8000-0000000000aa';
const BOOKING_ID = '7c1e0000-0000-4000-8000-0000000000bb';
const LEARNER = '7c1e0000-0000-4000-8000-0000000000cc';
const MSG_1 = '7c1e0000-0000-4000-8000-000000000011';
const MSG_2 = '7c1e0000-0000-4000-8000-000000000022';

function row(id: string, createdAt: string, body = 'xin chào'): Record<string, unknown> {
  return {
    id,
    class_id: CLASS_ID,
    booking_id: BOOKING_ID,
    sender_id: LEARNER,
    sender_role: 'learner',
    body,
    created_at: new Date(createdAt),
  };
}

describe('SqlChatRepository (FR-012)', () => {
  const source = { query: jest.fn() } as unknown as DataSource;
  const registry = {
    get: jest.fn().mockReturnValue(source),
    getSchema: jest.fn().mockReturnValue('live_class'),
  } as unknown as ModuleDataSourceRegistry;
  const repository = new SqlChatRepository(registry, 'live-class');

  beforeEach(() => jest.clearAllMocks());

  describe('append', () => {
    it('inserts and returns the stored row, mapped to the contract shape', async () => {
      (source.query as jest.Mock).mockResolvedValueOnce([
        row(MSG_1, '2026-10-26T10:00:00.000Z', 'Bài 3'),
      ]);

      const view = await repository.append({
        classId: CLASS_ID,
        bookingId: BOOKING_ID,
        senderId: LEARNER,
        senderRole: 'learner',
        body: 'Bài 3',
      });

      expect(view).toEqual({
        id: MSG_1,
        classId: CLASS_ID,
        bookingId: BOOKING_ID,
        senderId: LEARNER,
        senderRole: 'learner',
        body: 'Bài 3',
        createdAt: '2026-10-26T10:00:00.000Z',
      });

      const sql = (source.query as jest.Mock).mock.calls[0][0] as string;
      expect(sql).toContain('INSERT INTO "live_class"."chat_messages"');
      expect(sql).toContain('RETURNING');
      // Nothing here writes a flag or an update: the table is append-only.
      expect(sql).not.toMatch(/flagged|UPDATE/i);
    });

    it('generates the id rather than trusting a caller to pick one', async () => {
      (source.query as jest.Mock).mockResolvedValueOnce([row(MSG_1, '2026-10-26T10:00:00.000Z')]);
      await repository.append({
        classId: CLASS_ID,
        bookingId: BOOKING_ID,
        senderId: LEARNER,
        senderRole: 'teacher',
        body: 'ok',
      });
      const params = (source.query as jest.Mock).mock.calls[0][1] as unknown[];
      expect(params[0]).toMatch(/^[0-9a-f-]{36}$/);
      expect(params[4]).toBe('teacher');
    });

    it('fails loudly when the insert returns no row, instead of inventing one', async () => {
      (source.query as jest.Mock).mockResolvedValueOnce([]);
      await expect(
        repository.append({
          classId: CLASS_ID,
          bookingId: BOOKING_ID,
          senderId: LEARNER,
          senderRole: 'learner',
          body: 'ok',
        }),
      ).rejects.toThrow('Chat message insert returned no row');
    });
  });

  describe('list', () => {
    it('pages oldest-first and stops one row early to detect more', async () => {
      (source.query as jest.Mock)
        .mockResolvedValueOnce([
          row(MSG_1, '2026-10-26T10:00:00.000Z'),
          row(MSG_2, '2026-10-26T10:01:00.000Z'),
        ])
        .mockResolvedValueOnce([{ count: 5 }]);

      const result = await repository.list({ classId: CLASS_ID, limit: 1, cursor: null });

      expect(result.items.map((item) => item.id)).toEqual([MSG_1]);
      expect(result.nextCursor?.id).toBe(MSG_1);
      expect(result.total).toBe(5);
      const sql = (source.query as jest.Mock).mock.calls[0][0] as string;
      expect(sql).toContain('ORDER BY c."created_at" ASC, c."id" ASC');
      // limit + 1: the extra row is what proves another page exists.
      expect((source.query as jest.Mock).mock.calls[0][1]).toEqual([CLASS_ID, 2]);
    });

    it('walks forward from the cursor with a strict tuple comparison', async () => {
      (source.query as jest.Mock)
        .mockResolvedValueOnce([row(MSG_2, '2026-10-26T10:01:00.000Z')])
        .mockResolvedValueOnce([{ count: 2 }]);

      const result = await repository.list({
        classId: CLASS_ID,
        limit: 10,
        cursor: { createdAt: '2026-10-26T10:00:00.000000Z', id: MSG_1 },
      });

      expect(result.nextCursor).toBeNull();
      const sql = (source.query as jest.Mock).mock.calls[0][0] as string;
      // `>` not `>=`: a page must not repeat the row it resumed after.
      expect(sql).toContain('(c."created_at", c."id") > ($2::timestamptz, $3::uuid)');
      // The cursor timestamp travels as full-precision text, never as a JS Date.
      expect((source.query as jest.Mock).mock.calls[0][1][1]).toBe('2026-10-26T10:00:00.000000Z');
    });

    it('counts the whole conversation, not the page, so total does not shrink while paging', async () => {
      (source.query as jest.Mock)
        .mockResolvedValueOnce([row(MSG_2, '2026-10-26T10:01:00.000Z')])
        .mockResolvedValueOnce([{ count: 42 }]);

      const result = await repository.list({
        classId: CLASS_ID,
        limit: 10,
        cursor: { createdAt: '2026-10-26T10:00:00.000000Z', id: MSG_1 },
      });

      expect(result.total).toBe(42);
      const countSql = (source.query as jest.Mock).mock.calls[1][0] as string;
      expect(countSql).not.toContain('"created_at"');
      expect((source.query as jest.Mock).mock.calls[1][1]).toEqual([CLASS_ID]);
    });

    it('keeps the stored microsecond precision in the next cursor', async () => {
      (source.query as jest.Mock)
        .mockResolvedValueOnce([
          // Shaped as the SQL's `to_char(...)` cast emits: microsecond precision, UTC, `Z`.
          { ...row(MSG_1, '2026-10-26T10:00:00.046443Z'), created_at: '2026-10-26T10:00:00.046443Z' },
          // limit + 1: this extra row is what tells the repository another page exists.
          { ...row(MSG_2, '2026-10-26T10:01:00.000001Z'), created_at: '2026-10-26T10:01:00.000001Z' },
        ])
        .mockResolvedValueOnce([{ count: 2 }]);

      const first = await repository.list({ classId: CLASS_ID, limit: 1, cursor: null });
      // The cursor must carry the exact stored instant: a JS Date would hold .046, and the next
      // page would then re-emit the row it resumed after (that was the bug).
      expect(first.nextCursor?.createdAt).toBe('2026-10-26T10:00:00.046443Z');
    });

    it('accepts a Date as well as the pg text cast', async () => {
      (source.query as jest.Mock)
        .mockResolvedValueOnce([
          { ...row(MSG_1, '2026-10-26T10:00:00.000Z'), created_at: new Date('2026-10-26T10:00:00.000Z') },
        ])
        .mockResolvedValueOnce([{ count: '1' }]);

      const result = await repository.list({ classId: CLASS_ID, limit: 10, cursor: null });
      expect(result.items[0]?.createdAt).toBe('2026-10-26T10:00:00.000Z');
      expect(result.total).toBe(1);
    });

    it('scopes every read to one class, so a booking id cannot widen it', async () => {
      (source.query as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 0 }]);

      await repository.list({ classId: CLASS_ID, limit: 10, cursor: null });

      for (const call of (source.query as jest.Mock).mock.calls) {
        expect(call[0]).toContain('c."class_id" = $1');
      }
    });
  });
});
