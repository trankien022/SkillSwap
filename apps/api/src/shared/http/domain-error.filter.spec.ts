import { ArgumentsHost, BadRequestException, HttpException } from '@nestjs/common';
import { DomainErrorFilter, type HttpResponseLike } from './domain-error.filter';
import { ModuleNotInitialisedError } from '../errors';
import type { AppLogger } from '../logger/app-logger';

/** Local stand-ins: the filter classifies by `name`, not by class identity. */
class StatusTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition from ${from} to ${to}`);
    this.name = 'StatusTransitionError';
  }
}

class StatusConflictError extends Error {
  constructor(expected: string, actual: string) {
    super(`Expected ${expected} but was ${actual}`);
    this.name = 'StatusConflictError';
  }
}

class UnknownStateError extends Error {
  constructor(state: string) {
    super(`Unknown state ${state}`);
    this.name = 'UnknownStateError';
  }
}

/** Mirrors `LearnerNotVerifiedError` (AC-034 / BR-001): reason-bearing, distinct name. */
class LearnerNotVerifiedError extends Error {
  readonly reason = 'learner_not_verified';

  constructor(learnerId: string) {
    super(`Account ${learnerId} has no approved student verification`);
    this.name = 'LearnerNotVerifiedError';
  }
}

/** Mirrors `BookingNotAllowedError`: the envelope code must be the reason, not the name. */
class BookingNotAllowedError extends Error {
  constructor(
    readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = 'BookingNotAllowedError';
  }
}

class ClassNotFoundError extends Error {
  constructor(classId: string) {
    super(`Class ${classId} was not found`);
    this.name = 'ClassNotFoundError';
  }
}

/** Mirrors `ChatAccessDeniedError` (FR-012 / ADR-036): the reason decides the envelope code. */
class ChatAccessDeniedError extends Error {
  constructor(
    readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = 'ChatAccessDeniedError';
  }
}

interface Captured extends HttpResponseLike {
  statusCode?: number;
  body?: unknown;
}

function makeHost(captured: Captured): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => ({
        status(code: number) {
          captured.statusCode = code;
          return this;
        },
        json(body: unknown) {
          captured.body = body;
          return body;
        },
      }),
    }),
  } as unknown as ArgumentsHost;
}

function makeLogger(): AppLogger {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    child: jest.fn(),
  } as unknown as AppLogger;
}

function run(exception: unknown): Captured {
  const captured: Captured = { status: () => captured, json: () => undefined };
  new DomainErrorFilter(makeLogger()).catch(exception, makeHost(captured));
  return captured;
}

describe('DomainErrorFilter', () => {
  it('maps StatusTransitionError and StatusConflictError to a 409 failure envelope', () => {
    for (const error of [
      new StatusTransitionError('open', 'closed'),
      new StatusConflictError('open', 'closed'),
    ]) {
      const captured = run(error);
      expect(captured.statusCode).toBe(409);
      expect(captured.body).toMatchObject({
        success: false,
        code: error.name,
        message: error.message,
        data: null,
        errors: [{ code: error.name, message: error.message }],
      });
    }
  });

  it('maps UnknownStateError to 400', () => {
    expect(run(new UnknownStateError('bogus')).statusCode).toBe(400);
  });

  it('maps ModuleNotInitialisedError to 500', () => {
    expect(run(new ModuleNotInitialisedError('schedule')).statusCode).toBe(500);
  });

  it.each([
    'class_not_bookable',
    'class_started',
    'booking_window_closed',
    'class_full',
    'duplicate_booking',
    'self_booking',
    'invalid_duration',
  ])('reports the booking rejection reason %s as the envelope code (409)', (reason) => {
    const error = new BookingNotAllowedError(reason, 'rejected');
    const captured = run(error);
    expect(captured.statusCode).toBe(409);
    expect(captured.body).toMatchObject({
      success: false,
      code: reason,
      message: 'rejected',
      data: null,
      errors: [{ code: reason, message: 'rejected' }],
    });
  });

  // AC-034 / BR-001 (decided 2026-10-25): the booking trust gate has its own code,
  // so the client can explain *why* it cannot book rather than showing a generic 409.
  it('reports an unverified booker as `learner_not_verified` (409)', () => {
    const error = new LearnerNotVerifiedError('learner-1');
    const captured = run(error);
    expect(captured.statusCode).toBe(409);
    expect(captured.body).toMatchObject({
      success: false,
      code: 'learner_not_verified',
      data: null,
      errors: [{ code: 'learner_not_verified' }],
    });
  });

  it('maps ClassNotFoundError to 404 with a class_not_found code', () => {
    const captured = run(new ClassNotFoundError('class-1'));
    expect(captured.statusCode).toBe(404);
    expect(captured.body).toMatchObject({
      success: false,
      code: 'class_not_found',
      message: 'Class class-1 was not found',
      data: null,
    });
  });

  // FR-012 (ADR-036): a chat refusal carries its own code so a client can tell "not yours"
  // from "come back later" without matching English. This is the case that caught the bug:
  // the controller used to wrap these in ForbiddenException({ code }), and the HTTP branch
  // below reports HTTP_403 for every 403 -- discarding the code entirely.
  it('reports a chat party refusal as CHAT_NOT_A_PARTY (403)', () => {
    const captured = run(new ChatAccessDeniedError('not_a_party', 'Requester is not a party'));
    expect(captured.statusCode).toBe(403);
    expect(captured.body).toMatchObject({
      success: false,
      code: 'CHAT_NOT_A_PARTY',
      data: null,
      errors: [{ code: 'CHAT_NOT_A_PARTY' }],
    });
  });

  it.each(['booking_not_confirmed', 'window_not_open', 'window_closed'] as const)(
    'reports a %s chat refusal as CHAT_WINDOW_CLOSED',
    (reason) => {
      const captured = run(new ChatAccessDeniedError(reason, reason));
      expect(captured.statusCode).toBe(403);
      expect(captured.body).toMatchObject({ code: 'CHAT_WINDOW_CLOSED' });
    },
  );

  it('wraps an HttpException string payload (validation) in the failure envelope', () => {
    const captured = run(new BadRequestException('name: required'));
    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({
      success: false,
      code: 'VALIDATION_FAILED',
      message: 'name: required',
      data: null,
      errors: [{ code: 'VALIDATION_FAILED', message: 'name: required' }],
    });
  });

  it('maps a non-validation HttpException to HTTP_<status>', () => {
    const captured = run(new HttpException('nope', 418));
    expect(captured.statusCode).toBe(418);
    expect(captured.body).toMatchObject({
      success: false,
      code: 'HTTP_418',
      message: 'nope',
      data: null,
    });
  });

  it('expands class-validator-style field errors into one entry per field', () => {
    const captured = run(
      new BadRequestException({ message: ['email must be an email', 'password too short'] }),
    );
    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({
      success: false,
      code: 'VALIDATION_FAILED',
      errors: [
        { code: 'VALIDATION_FAILED', message: 'email must be an email' },
        { code: 'VALIDATION_FAILED', message: 'password too short' },
      ],
    });
  });

  it('falls back to a 500 INTERNAL_ERROR envelope for unknown errors', () => {
    const captured = run(new Error('kaboom'));
    expect(captured.statusCode).toBe(500);
    expect(captured.body).toMatchObject({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      data: null,
      errors: [{ code: 'INTERNAL_ERROR', message: 'Internal server error' }],
    });
  });
});
