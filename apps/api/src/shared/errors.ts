/**
 * Shared, transport-neutral error types.
 *
 * Classes set `this.name` explicitly because consumers (DomainErrorFilter,
 * RabbitConsumer) classify failures by name across module boundaries where
 * `instanceof` would be unreliable.
 */

export class BrokerUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'BrokerUnavailableError';
  }
}

export class ModuleNotInitialisedError extends Error {
  constructor(moduleName: string) {
    super(`Module "${moduleName}" data source is not initialised`);
    this.name = 'ModuleNotInitialisedError';
  }
}

export class PermanentHandlerError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PermanentHandlerError';
  }
}

/**
 * ADR-013 Amendment A (W2 C2, decided 2026-10-25): the payload itself failed
 * validation at publish time. This is the **only** publish failure allowed to mark
 * an outbox row `DEAD` — retrying it can never succeed, so burning the row is
 * correct rather than lossy.
 */
export class OutboxPayloadInvalidError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'OutboxPayloadInvalidError';
  }
}

/**
 * NFR-014: a keyset cursor that cannot be honoured — malformed, truncated, or carrying the
 * wrong number of key parts for the endpoint's sort.
 *
 * It is surfaced (400 `INVALID_CURSOR`) rather than ignored, because silently restarting at
 * page one in response to a bad cursor looks to a caller like data corruption.
 */
export class InvalidCursorError extends Error {
  constructor(message = 'The pagination cursor is not valid') {
    super(message);
    this.name = 'InvalidCursorError';
  }
}

export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}
