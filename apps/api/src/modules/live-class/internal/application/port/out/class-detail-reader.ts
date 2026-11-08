import type { ClassFormat, ClassLevel } from '../../../domain/class';
import type { BookingStateDto, ClassLifecycleStateDto } from '../in/get-class-detail';

export const CLASS_DETAIL_READER = Symbol('CLASS_DETAIL_READER');

export interface CallerBookingRecord {
  readonly id: string;
  readonly state: BookingStateDto;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
}

export interface ClassDetailRecord {
  readonly id: string;
  readonly teacherId: string;
  readonly skillIds: readonly string[];
  readonly title: string;
  /** B2: the level the class is taught at, or null when never recorded. */
  readonly level: ClassLevel | null;
  /** B3: derived from capacity by `classFormatOf`, so list and detail cannot disagree. */
  readonly format: ClassFormat;
  readonly description: string;
  readonly startsAt: Date;
  readonly durationMinutes: number;
  readonly priceCredits: number;
  readonly capacity: number;
  readonly confirmedBookingsCount: number;
  readonly heldSeatsCount: number;
  readonly availableSeats: number;
  readonly state: ClassLifecycleStateDto;
  readonly callerBookings: readonly CallerBookingRecord[];
}

export interface ClassDetailReader {
  readDetail(classId: string, callerId: string, now: Date): Promise<ClassDetailRecord | null>;
}
