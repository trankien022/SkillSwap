import type { SubmitRatingCommand, SubmitRatingPort } from './port/in/submit-rating';
import type { RatingRepository } from './port/out/rating-repository';
import type { RatingView } from '@skillswap/contracts';

export class SubmitRatingUseCase implements SubmitRatingPort {
  constructor(private readonly ratings: RatingRepository) {}
  execute(command: SubmitRatingCommand): Promise<RatingView> {
    return this.ratings.createForEligibleBooking(command.bookingId, command.learnerId, {
      stars: command.stars,
      comment: command.comment,
    });
  }
}
