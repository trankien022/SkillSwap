export const RELEASE_COMPLETED_CLASS = Symbol('RELEASE_COMPLETED_CLASS');

export interface CompletedClassBooking {
  bookingId: string;
  learnerId: string;
  priceCredits: number;
}

export interface ClassCompletedInput {
  classId: string;
  teacherId: string;
  bookings: CompletedClassBooking[];
}

export interface ReleaseCompletedClassResult {
  released: number;
}

export interface ReleaseCompletedClassPort {
  execute(event: ClassCompletedInput): Promise<ReleaseCompletedClassResult>;
}
