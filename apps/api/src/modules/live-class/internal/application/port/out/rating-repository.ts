import type { CreateRatingInput, RatingView } from '@skillswap/contracts';

export const RATING_REPOSITORY = Symbol('RATING_REPOSITORY');

/** Read-side facts about the ratings of one class. */
export interface RatingAggregate {
  /** Mean of `stars`, rounded to 2 decimals; `null` when the class has no ratings. */
  readonly average: number | null;
  readonly count: number;
}

/**
 * A rating as the class page shows it: the learner is a display name, never an id, because the
 * name is resolved through the account-profile facade rather than joined across schemas (ADR-014).
 */
export interface RatingRecentView {
  readonly id: string;
  readonly learnerDisplayName: string;
  readonly stars: number;
  readonly comment: string;
  readonly createdAt: string;
}

export interface RatingRepository {
  createForEligibleBooking(
    bookingId: string,
    learnerId: string,
    input: CreateRatingInput,
  ): Promise<RatingView>;

  /**
   * One aggregate row set for the whole page. Classes with no ratings are simply absent from the
   * map, so a caller renders `null`/`0` without a per-class query (no N+1).
   */
  readAggregate(classIds: readonly string[]): Promise<ReadonlyMap<string, RatingAggregate>>;

  /** Newest first, at most `limit`, most recent first. */
  readRecent(classId: string, limit: number): Promise<readonly RatingRecentView[]>;
}
