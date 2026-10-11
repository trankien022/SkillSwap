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
