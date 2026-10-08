import { ArgumentsHost, Catch, HttpException, type ExceptionFilter } from '@nestjs/common';
import type { AppLogger } from '../logger/app-logger';

/** Local structural view of Express's Response (the app never imports express). */
export interface HttpResponseLike {
  status(code: number): HttpResponseLike;
  json(body: unknown): unknown;
}

interface ErrorResponseBody {
  statusCode: number;
  message: string;
  error?: string;
}

const NAME_TO_STATUS: Record<string, number> = {
  StatusConflictError: 409,
  StatusTransitionError: 409,
  UnknownStateError: 400,
  ModuleNotInitialisedError: 500,
  BookingNotAllowedError: 409,
  ClassNotFoundError: 404,
  UnknownClassStateError: 400,
  ClassTransitionError: 409,
  InvalidDurationError: 400,
  InvalidCapacityError: 400,
  InvalidPriceError: 400,
  InvalidStartTimeError: 400,
};

/** Maps domain errors and unexpected failures onto the apiErrorSchema shape. */
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponseLike>();
    const { statusCode, body } = this.toResponse(exception);

    if (statusCode >= 500) {
      this.logger.error({ statusCode, err: exception }, body.message);
    } else {
      this.logger.warn({ statusCode }, body.message);
    }

    response.status(statusCode).json(body);
  }

  private toResponse(exception: unknown): { statusCode: number; body: ErrorResponseBody } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        return { statusCode, body: { statusCode, message: payload } };
      }
      const body = payload as Record<string, unknown>;
      return {
        statusCode,
        body: { ...(body as unknown as ErrorResponseBody), statusCode },
      };
    }

    const name =
      exception instanceof Error ? exception.name : (exception as { name?: string } | null)?.name;
    if (name !== undefined && name in NAME_TO_STATUS) {
      const statusCode = NAME_TO_STATUS[name];
      const message = exception instanceof Error ? exception.message : name;
      return { statusCode, body: { statusCode, message, error: name } };
    }

    return {
      statusCode: 500,
      body: { statusCode: 500, message: 'Internal server error' },
    };
  }
}
