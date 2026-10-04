import type { LoggerService } from '@nestjs/common';
import { pino, type Logger } from 'pino';
import { describeError } from '../errors';

const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;
type LogLevel = (typeof LEVELS)[number];

function resolveLevel(level: string | undefined): LogLevel {
  return level !== undefined && (LEVELS as readonly string[]).includes(level)
    ? (level as LogLevel)
    : 'info';
}

/**
 * Nest-compatible logger backed by pino. Every record is emitted with an
 * object as the first argument (carrying `context`) so structured fields are
 * never lost, regardless of how callers pass messages in.
 */
export class AppLogger implements LoggerService {
  private readonly context: string;
  private readonly logger: Logger;

  constructor(context: string, options?: { level?: string; logger?: Logger }) {
    this.context = context;
    this.logger = options?.logger ?? pino({ level: resolveLevel(options?.level) });
  }

  /** pino instance for pino-http and other low-level integrations. */
  get raw(): Logger {
    return this.logger;
  }

  /** Derived logger whose context is extended and whose records share the same sink. */
  child(context: string): AppLogger {
    return new AppLogger(`${this.context}.${context}`, { logger: this.logger.child({}) });
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('trace', message, optionalParams);
  }

  private write(level: LogLevel, message: unknown, extra: unknown[]): void {
    const payload: Record<string, unknown> = { context: this.context };
    let text: string;

    if (message instanceof Error) {
      text = message.message;
      payload.err = message;
    } else if (typeof message === 'object' && message !== null) {
      Object.assign(payload, message);
      text = extra.length > 0 ? describeError(extra[0]) : 'log';
    } else {
      text = describeError(message);
      if (extra.length > 0) {
        payload.extra = extra.map(describeError);
      }
    }

    this.logger[level](payload, text);
  }
}
