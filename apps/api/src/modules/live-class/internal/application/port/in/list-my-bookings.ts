export const LIST_MY_BOOKINGS = Symbol('LIST_MY_BOOKINGS');

export const BOOKING_STATES = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
] as const;
export type BookingStateDto = (typeof BOOKING_STATES)[number];

export const CLASS_LIFECYCLE_STATES = [
  'draft',
  'published',
  'full',
  'in_progress',
  'completed',
  'cancelled',
] as const;
export type ClassLifecycleStateDto = (typeof CLASS_LIFECYCLE_STATES)[number];

export type BookingCursorTuple = readonly [startsAtISO: string, bookingId: string];

export interface ListMyBookingsQuery {
  readonly learnerId: string;
  readonly state?: BookingStateDto;
  readonly upcoming?: boolean;
  readonly limit?: number;
  readonly cursor?: BookingCursorTuple;
}

export interface LearnerBookingClassSummaryDto {
  readonly description: string;
  readonly skillIds: readonly string[];
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly teacherId: string;
  readonly teacherDisplayName: string;
  readonly classState: ClassLifecycleStateDto;
}

export interface LearnerBookingItemDto {
  readonly bookingId: string;
  readonly classId: string;
  readonly state: BookingStateDto;
  readonly priceCredits: number;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly classSummary: LearnerBookingClassSummaryDto;
  readonly roomAccessEligible: boolean;
  readonly ratingEligible: boolean;
  readonly hasRated: boolean;
}

export interface MyBookingsPageDto {
  readonly items: readonly LearnerBookingItemDto[];
  readonly nextCursor: BookingCursorTuple | null;
  readonly totalUpcomingCount: number;
}

export interface ListMyBookingsPort {
  execute(query: ListMyBookingsQuery): Promise<MyBookingsPageDto>;
}
