import { markNotificationsReadResponseSchema, notificationsPageSchema } from './mobile-notifications';

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
