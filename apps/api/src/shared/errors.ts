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
