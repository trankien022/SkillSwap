import en from '@/i18n/en.json';
import vi from '@/i18n/vi.json';
import { BOOKING_REJECTION_REASONS, BookingError } from './booking';

describe('booking rejection reasons', () => {
  it('includes learner_not_verified', () => {
    expect(BOOKING_REJECTION_REASONS).toContain('learner_not_verified');
    expect(new BookingError('learner_not_verified', 'x').reason).toBe('learner_not_verified');
  });

  it.each([
    ['en', en],
    ['vi', vi],
  ])('has a %s message for every rejection reason', (_locale, messages) => {
    for (const reason of BOOKING_REJECTION_REASONS) {
      expect(messages.Booking[`error.${reason}` as keyof typeof messages.Booking]).toEqual(expect.any(String));
    }
    expect(messages.ClassDetail.errorLearnerNotVerified).toEqual(expect.any(String));
  });
});
