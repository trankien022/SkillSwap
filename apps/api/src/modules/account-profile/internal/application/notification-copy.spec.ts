import { notificationCopy } from './notification-copy';

describe('notification copy', () => {
  it('uses Vietnamese for Vietnamese installations', () => {
    expect(notificationCopy('booking_cancelled', 'vi')?.title).toBe('Lớp học đã hủy');
    expect(notificationCopy('booking_cancelled', 'vi')?.body).not.toContain('hoàn tiền');
  });
  it('uses English for English installations', () => {
    expect(notificationCopy('booking_cancelled', 'en')?.title).toBe('Class canceled');
  });
  it.each(['booking_confirmed', 'verification_outcome', 'wallet_transaction', 'class_starting_soon', 'withdrawal_outcome'])('supports both languages for %s', (type) => {
    expect(notificationCopy(type, 'vi')).toBeDefined();
    expect(notificationCopy(type, 'en')).toBeDefined();
    expect(notificationCopy(type, 'vi')).not.toEqual(notificationCopy(type, 'en'));
  });
});
