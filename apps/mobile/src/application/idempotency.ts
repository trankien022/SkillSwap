/**
 * Client idempotency key for a booking attempt (PRD §10: financial commands
 * carry an idempotency key). Stable per attempt so a retry replays, not duplicaates.
 */
export function newIdempotencyKey(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `book-${Date.now().toString(36)}-${random}`;
}
