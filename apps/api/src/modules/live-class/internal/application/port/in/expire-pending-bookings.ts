export const EXPIRE_PENDING_BOOKINGS = Symbol('EXPIRE_PENDING_BOOKINGS');

export interface ExpirePendingBookingsPort {
  /** Cancels expired pending holds and returns how many were released. */
  execute(): Promise<{ expired: number }>;
}
