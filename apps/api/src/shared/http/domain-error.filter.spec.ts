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
