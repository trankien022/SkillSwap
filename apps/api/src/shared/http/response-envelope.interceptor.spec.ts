import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';
import { RawResponse, ResponseCode, ResponseMessage } from './response-code.decorator';

/** Minimal ExecutionContext stand-in: the interceptor only reads handler/class metadata. */
function makeContext(handler: object, controller: object): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getResponse: () => ({}) }),
  } as unknown as ExecutionContext;
}

function makeHandler(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

class PlainController {
  handler(): void {}
}

class DecoratedController {
  @ResponseCode('WALLET_HISTORY_OK')
  @ResponseMessage('Wallet history loaded')
  handler(): void {}

  @RawResponse()
  raw(): void {}
}

describe('ResponseEnvelopeInterceptor', () => {
  const interceptor = new ResponseEnvelopeInterceptor(new Reflector());

  it('wraps a payload in the success envelope with default code/message', async () => {
    const ctx = makeContext(PlainController.prototype.handler, PlainController);
    const result = await firstValueFrom(interceptor.intercept(ctx, makeHandler({ a: 1 })));
    expect(result).toEqual({
      success: true,
      code: 'OK',
      message: 'OK',
      data: { a: 1 },
      errors: [],
    });
  });

  it('uses the operation code and message metadata', async () => {
    const ctx = makeContext(DecoratedController.prototype.handler, DecoratedController);
    const result = await firstValueFrom(
      interceptor.intercept(ctx, makeHandler({ items: [] })),
    );
    expect(result).toMatchObject({
      code: 'WALLET_HISTORY_OK',
      message: 'Wallet history loaded',
      data: { items: [] },
      errors: [],
    });
  });

  it('passes a @RawResponse() handler through untouched', async () => {
    const ctx = makeContext(DecoratedController.prototype.raw, DecoratedController);
    const result = await firstValueFrom(
      interceptor.intercept(ctx, makeHandler({ status: 'ok' })),
    );
    expect(result).toEqual({ status: 'ok' });
  });

  it('normalises undefined to a null data payload', async () => {
    const ctx = makeContext(PlainController.prototype.handler, PlainController);
    const result = await firstValueFrom(interceptor.intercept(ctx, makeHandler(undefined)));
    expect(result).toMatchObject({ success: true, data: null });
  });
});
