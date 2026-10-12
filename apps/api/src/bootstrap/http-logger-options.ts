import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Logger } from 'pino';
import { stdSerializers, type Options } from 'pino-http';

const REDACTED_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-user-email',
  'proxy-authorization',
]);

function redactHeaders(
  headers: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!headers || typeof headers !== 'object') return headers;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    sanitized[key] = REDACTED_HEADERS.has(key.toLowerCase()) ? '[Redacted]' : value;
  }
  return sanitized;
}

export function createHttpLoggerOptions(logger: Logger): Options {
  return {
    logger,
    wrapSerializers: false,
    genReqId: (req: IncomingMessage) => {
      const headerId = req.headers['x-request-id'] ?? req.headers['x-correlation-id'];
      if (typeof headerId === 'string' && headerId.length > 0) return headerId;
      if (Array.isArray(headerId) && headerId[0]) return headerId[0];
      const existingId = (req as unknown as { id?: string | number }).id;
      return existingId !== undefined ? existingId : randomUUID();
    },
    serializers: {
      req: (req: unknown) => {
        const serialized = stdSerializers.req(req as IncomingMessage);
        return {
          ...serialized,
          headers: redactHeaders(serialized.headers as Record<string, unknown> | undefined),
        };
      },
      res: (res: unknown) => {
        const serialized = stdSerializers.res(res as ServerResponse);
        return {
          ...serialized,
          headers: redactHeaders(serialized.headers as Record<string, unknown> | undefined),
        };
      },
    },
  };
}
