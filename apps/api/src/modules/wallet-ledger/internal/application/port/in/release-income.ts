export const RELEASE_INCOME = Symbol('RELEASE_INCOME');

export interface ReleaseIncomeInput {
  bookingId: string;
  teacherId: string;
  amountCredits: number;
  /** Idempotency key; a retry with a different key must not double-release (AC-015). */
  releaseKey: string;
}

export interface ReleaseIncomeResult {
  applied: boolean;
}

export interface ReleaseIncomePort {
  execute(input: ReleaseIncomeInput): Promise<ReleaseIncomeResult>;
}
