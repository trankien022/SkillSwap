/**
 * FR-018: a viewer is not permitted to read the requested resource (e.g. a
 * non-owner, non-reviewer, non-admin reading another account's evidence history).
 */
export class AccessDeniedError extends Error {
  constructor(viewerId: string) {
    super(`Account ${viewerId} is not permitted to read this resource`);
    this.name = 'AccessDeniedError';
  }
}
