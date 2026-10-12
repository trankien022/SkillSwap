import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Observable, map } from 'rxjs';
import {
  DEFAULT_RESPONSE_CODE,
  DEFAULT_RESPONSE_MESSAGE,
  RAW_RESPONSE_KEY,
  RESPONSE_CODE_KEY,
  RESPONSE_MESSAGE_KEY,
} from './response-code.decorator';

/** NFR-013: the success envelope this interceptor produces. */
export interface SuccessEnvelope<T> {
  success: true;
  code: string;
  message: string;
  data: T;
  errors: [];
}

/**
 * Wraps every handler result in the uniform success envelope
 * `{ success: true, code, message, data, errors: [] }`.
 *
 * Handlers annotated with `@RawResponse()` (the health probes) pass through untouched.
 * The error envelope is produced by `DomainErrorFilter`, not here.
 */
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (raw === true) {
      return next.handle();
    }

    const code =
      this.reflector.getAllAndOverride<string>(RESPONSE_CODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_RESPONSE_CODE;
    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? DEFAULT_RESPONSE_MESSAGE;

    return next.handle().pipe(
      map(
        (data): SuccessEnvelope<unknown> => ({
          success: true,
          code,
          message,
          data: data ?? null,
          errors: [],
        }),
      ),
    );
  }
}
