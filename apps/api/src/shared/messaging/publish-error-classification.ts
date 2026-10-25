import { isTransient } from './rabbit-consumer';
import { OutboxPayloadInvalidError } from '../errors';

/**
 * ADR-013 Amendment A / W2 C2 (decided 2026-10-25): is this publish failure
 * retryable?
 *
 * The asymmetry is the whole point. Retrying a poison payload costs log noise;
 * dropping a real event costs money (BR-033). So a failure is terminal **only**
 * when it is provably the payload's fault — everything else, including errors we
 * do not recognise, keeps the row `PENDING`.
 *
 * Classification is by name, not `instanceof`, because a schema-validation error
 * raised in another module would otherwise slip through (see `shared/errors.ts`).
 */
export function isRetryablePublishError(error: unknown): boolean {
  if (isTerminalPublishError(error)) {
    return false;
  }
  return true;
}

/** The single non-retryable case: the payload failed validation at publish time. */
export function isTerminalPublishError(error: unknown): boolean {
  if (error instanceof OutboxPayloadInvalidError) {
    return true;
  }
  // `isTransient` is exported from the consumer: if the transport says retry,
  // it is retryable no matter how else the error looks.
  if (isTransient(error)) {
    return false;
  }
  const name = (error as { name?: unknown } | null)?.name;
  return name === 'OutboxPayloadInvalidError';
}
