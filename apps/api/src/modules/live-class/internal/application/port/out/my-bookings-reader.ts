import type {
  BookingCursorTuple,
  BookingStateDto,
  ClassLifecycleStateDto,
} from '../in/list-my-bookings';

export const MY_BOOKINGS_READER = Symbol('MY_BOOKINGS_READER');

export interface LearnerBookingClassRecord {
  readonly description: string;
  readonly skillIds: readonly string[];
  readonly startsAt: Date;
  readonly durationMinutes: number;
  readonly teacherId: string;
  readonly classState: ClassLifecycleStateDto;
}

export interface LearnerBookingRecord {
  readonly bookingId: string;
  readonly classId: string;
  readonly state: BookingStateDto;
  readonly priceCredits: number;
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
  readonly hasRated?: boolean;
  readonly class: LearnerBookingClassRecord;
}

export interface FindMyBookingsCriteria {
  readonly learnerId: string;
  readonly state?: BookingStateDto;
  readonly upcoming?: boolean;
  readonly limit: number;
  readonly cursor?: readonly [startsAt: Date, bookingId: string];
  readonly now: Date;
}

export interface MyBookingsReaderResult {
  readonly items: readonly LearnerBookingRecord[];
  readonly nextCursor: BookingCursorTuple | null;
}

export interface MyBookingsReader {
  findBookings(criteria: FindMyBookingsCriteria): Promise<MyBookingsReaderResult>;
  countTotalUpcoming(learnerId: string, now: Date): Promise<number>;
}
