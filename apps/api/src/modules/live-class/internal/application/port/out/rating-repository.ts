import type { CreateRatingInput, RatingView } from '@skillswap/contracts';

export const RATING_REPOSITORY = Symbol('RATING_REPOSITORY');
export interface RatingRepository { createForEligibleBooking(bookingId: string, learnerId: string, input: CreateRatingInput): Promise<RatingView> }
