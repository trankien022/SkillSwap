import type { CreateRatingInput, RatingView } from '@skillswap/contracts';

export const SUBMIT_RATING = Symbol('SUBMIT_RATING');
export interface SubmitRatingCommand extends CreateRatingInput { bookingId: string; learnerId: string }
export interface SubmitRatingPort { execute(command: SubmitRatingCommand): Promise<RatingView> }
export class RatingNotEligibleError extends Error { constructor(message: string) { super(message); this.name = 'RatingNotEligibleError'; } }
export class RatingAlreadyExistsError extends Error { constructor() { super('Booking already has a rating'); this.name = 'RatingAlreadyExistsError'; } }
