export const GET_CLASS_DETAIL = Symbol('GET_CLASS_DETAIL');

export const CLASS_LIFECYCLE_STATES = [
  'draft',
  'published',
  'full',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type ClassLifecycleStateDto = (typeof CLASS_LIFECYCLE_STATES)[number];

export const BOOKING_STATES = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'disputed',
] as const;
export type BookingStateDto = (typeof BOOKING_STATES)[number];

export interface GetClassDetailQuery {
  readonly classId: string;
  readonly callerId: string;
}

export interface ClassDetailTeacherDto {
  readonly id: string;
  readonly displayName: string;
  readonly averageRating: number | null;
  readonly ratingsCount: number;
}

export interface ClassDetailRatingDto {
  readonly id: string;
  readonly learnerDisplayName: string;
  readonly stars: number;
  readonly comment: string;
  readonly createdAt: string;
}

export interface OwnBookingSummaryDto {
  readonly bookingId: string;
  readonly state: BookingStateDto;
  readonly expiresAt: string | null;
}

export interface ClassDetailDto {
  readonly id: string;
  readonly teacher: ClassDetailTeacherDto;
  readonly skillIds: readonly string[];
  readonly description: string;
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly priceCredits: number;
  readonly capacity: number;
  readonly availableSeats: number;
  readonly state: ClassLifecycleStateDto;
  readonly canBook: boolean;
  readonly recentRatings: readonly ClassDetailRatingDto[];
  readonly ownBooking: OwnBookingSummaryDto | null;
}

export class ClassDetailNotFoundError extends Error {
  constructor(public readonly classId: string) {
    super(`Class ${classId} was not found or is not accessible`);
    this.name = 'ClassDetailNotFoundError';
  }
}

export interface GetClassDetailPort {
  execute(query: GetClassDetailQuery): Promise<ClassDetailDto>;
}
