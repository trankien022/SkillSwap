import { SubmitRatingUseCase } from './submit-rating.use-case';
import type { RatingRepository } from './port/out/rating-repository';

describe('SubmitRatingUseCase', () => {
  it('delegates only caller, booking and validated rating fields to persistence', async () => {
    const ratings: RatingRepository = { createForEligibleBooking: jest.fn().mockResolvedValue({ id: 'r1' }) };
    const useCase = new SubmitRatingUseCase(ratings);
    await useCase.execute({ bookingId: 'b1', learnerId: 'u1', stars: 5, comment: 'Great class' });
    expect(ratings.createForEligibleBooking).toHaveBeenCalledWith('b1', 'u1', { stars: 5, comment: 'Great class' });
  });
});
