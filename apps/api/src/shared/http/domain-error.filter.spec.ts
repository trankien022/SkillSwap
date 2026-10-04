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

describe('DomainErrorFilter', () => {
  it('maps StatusTransitionError and StatusConflictError to 409', () => {
    for (const error of [new StatusTransitionError('open', 'closed'), new StatusConflictError('open', 'closed')]) {
      const captured: Captured = { status: () => captured, json: () => undefined };
      new DomainErrorFilter(makeLogger()).catch(error, makeHost(captured));
      expect(captured.statusCode).toBe(409);
      expect(captured.body).toMatchObject({ statusCode: 409, error: error.name });
    }
  });

  it('maps UnknownStateError to 400', () => {
    const captured: Captured = { status: () => captured, json: () => undefined };
    new DomainErrorFilter(makeLogger()).catch(new UnknownStateError('bogus'), makeHost(captured));
    expect(captured.statusCode).toBe(400);
  });

  it('maps ModuleNotInitialisedError to 500', () => {
    const captured: Captured = { status: () => captured, json: () => undefined };
    new DomainErrorFilter(makeLogger()).catch(
      new ModuleNotInitialisedError('schedule'),
      makeHost(captured),
    );
    expect(captured.statusCode).toBe(500);
  });

  it('passes HttpException status and message through', () => {
    const captured: Captured = { status: () => captured, json: () => undefined };
    new DomainErrorFilter(makeLogger()).catch(
      new BadRequestException('bad input'),
      makeHost(captured),
    );
    expect(captured.statusCode).toBe(400);
    expect(captured.body).toMatchObject({ statusCode: 400, message: 'bad input' });
  });

  it('falls back to 500 for unknown errors', () => {
    const captured: Captured = { status: () => captured, json: () => undefined };
    new DomainErrorFilter(makeLogger()).catch(new Error('kaboom'), makeHost(captured));
    expect(captured.statusCode).toBe(500);
    expect(captured.body).toMatchObject({ statusCode: 500, message: 'Internal server error' });
  });

  it('keeps object payloads but forces statusCode', () => {
    const captured: Captured = { status: () => captured, json: () => undefined };
    new DomainErrorFilter(makeLogger()).catch(
      new HttpException({ statusCode: 0, message: 'weird' }, 418),
      makeHost(captured),
    );
    expect(captured.statusCode).toBe(418);
    expect(captured.body).toMatchObject({ statusCode: 418, message: 'weird' });
  });
});
