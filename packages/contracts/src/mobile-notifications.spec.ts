import {
  listNotificationsQuerySchema,
  markNotificationsReadResponseSchema,
  notificationsPageSchema,
} from './mobile-notifications';

describe('mobile-notifications contracts', () => {
  describe('markNotificationsReadResponseSchema (B6)', () => {
    it('accepts the shape both mark-read routes answer with', () => {
      expect(markNotificationsReadResponseSchema.parse({ success: true, unreadCount: 2 })).toEqual({
        success: true,
        unreadCount: 2,
      });
    });

    it('accepts an empty inbox', () => {
      expect(markNotificationsReadResponseSchema.parse({ success: true, unreadCount: 0 }).unreadCount).toBe(0);
    });

    it('rejects a failure envelope, a negative count and a fractional count', () => {
      expect(() => markNotificationsReadResponseSchema.parse({ success: false, unreadCount: 0 })).toThrow();
      expect(() => markNotificationsReadResponseSchema.parse({ success: true, unreadCount: -1 })).toThrow();
      expect(() => markNotificationsReadResponseSchema.parse({ success: true, unreadCount: 1.5 })).toThrow();
      expect(() => markNotificationsReadResponseSchema.parse({ success: true })).toThrow();
    });
  });

  /**
   * `unreadOnly=false` used to parse as `true`: `Boolean('false')` is `true`, and Node hands
   * every query parameter over as a string. `myBookingsQuerySchema` already solves this exact
   * hazard with `z.enum(['true','false']).transform(v => v === 'true')`; this block pins the
   * two boolean query params to the same behaviour so they cannot drift apart again.
   */
  describe('listNotificationsQuerySchema — unreadOnly', () => {
    it('maps "true" and "false" to the boolean they spell', () => {
      expect(listNotificationsQuerySchema.parse({ unreadOnly: 'true' }).unreadOnly).toBe(true);
      expect(listNotificationsQuerySchema.parse({ unreadOnly: 'false' }).unreadOnly).toBe(false);
    });

    it('leaves an omitted unreadOnly undefined, so "no filter" stays distinct from false', () => {
      expect(listNotificationsQuerySchema.parse({}).unreadOnly).toBeUndefined();
    });

    it('rejects the strings that were silently read as true', () => {
      for (const value of ['0', '1', 'no', 'yes', '', 'null']) {
        expect(() => listNotificationsQuerySchema.parse({ unreadOnly: value })).toThrow();
      }
    });

    it('leaves limit and cursor behaviour alone', () => {
      const parsed = listNotificationsQuerySchema.parse({ limit: '5', cursor: 'abc' });
      expect(parsed.limit).toBe(5);
      expect(parsed.cursor).toBe('abc');
      expect(parsed.unreadOnly).toBeUndefined();
      expect(() => listNotificationsQuerySchema.parse({ limit: 0 })).toThrow();
    });
  });

  describe('notificationsPageSchema', () => {
    it('carries the read flag per item and an exact unread count', () => {
      const page = notificationsPageSchema.parse({
        items: [
          {
            id: 'n1',
            type: 'booking_confirmed',
            title: 'Đặt lớp thành công',
            body: 'Lớp bạn đặt đã được xác nhận.',
            targetType: 'booking',
            targetId: 'b1',
            read: true,
            createdAt: '2026-11-07T10:00:00.000Z',
          },
        ],
        nextCursor: null,
        unreadCount: 0,
      });

      expect(page.items[0]?.read).toBe(true);
      expect(page.unreadCount).toBe(0);
    });
  });
});
