/**
 * ADR-023 Amendment A: the caller is not permitted to read a verification document.
 *
 * Only `admin` and `verifier` may mint a download URL. A learner is never refused here — they are
 * not offered a URL at all; `GET /student-verifications/me` gives them the reference to what they
 * themselves uploaded. So reaching this error means a non-reviewer called the reviewer route, which
 * is why the message says what the rule is rather than naming the caller's id.
 *
 * Named distinctly from `skill-verification`'s `AccessDeniedError` because the two modules own
 * separate domains and must not share error types (ADR-005/ADR-011 module isolation).
 */
export class DocumentReadDeniedError extends Error {
  constructor(actorId: string) {
    super(`Account ${actorId} is not permitted to read a verification document`);
    this.name = 'DocumentReadDeniedError';
  }
}
