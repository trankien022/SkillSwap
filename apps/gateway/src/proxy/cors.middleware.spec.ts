import type { Request, RequestHandler, Response } from 'express';
import { corsMiddleware } from './cors.middleware';

/** Records header writes so a test can assert exactly what the browser sees. */
class MockResponse {
  readonly headers: Record<string, string> = {};
  statusCode = 200;
  ended = false;

  setHeader(name: string, value: string): this {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  end(): this {
    this.ended = true;
    return this;
  }
}

function request(
  method: string,
  headers: Record<string, string> = {},
): Request {
  return { method, headers } as unknown as Request;
}

function run(
  handler: RequestHandler,
  req: Request,
  res: MockResponse,
): { nextCalled: boolean } {
  let nextCalled = false;
  handler(req, res as unknown as Response, (() => {
    nextCalled = true;
  }) as never);
  return { nextCalled };
}

const ORIGIN = 'http://localhost:8081';

describe('corsMiddleware', () => {
  it('echoes an allow-listed origin with credentials and methods', () => {
    const res = new MockResponse();
    const { nextCalled } = run(
      corsMiddleware([ORIGIN]),
      request('GET', { origin: ORIGIN }),
      res,
    );

    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    // The canonical-form origin must be echoed, never a wildcard.
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
    expect(res.headers.vary).toBe('Origin');
    expect(nextCalled).toBe(true);
  });

  it('omits CORS headers for an origin that is not allow-listed', () => {
    const res = new MockResponse();
    run(corsMiddleware([ORIGIN]), request('GET', { origin: 'http://evil.test' }), res);

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('omits CORS headers when the request carries no Origin', () => {
    const res = new MockResponse();
    run(corsMiddleware([ORIGIN]), request('GET'), res);

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers a preflight with 204 and does not forward it', () => {
    const res = new MockResponse();
    const { nextCalled } = run(
      corsMiddleware([ORIGIN]),
      request('OPTIONS', { origin: ORIGIN }),
      res,
    );

    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(nextCalled).toBe(false);
  });

  it('allows the headers the clients actually send', () => {
    const res = new MockResponse();
    run(corsMiddleware([ORIGIN]), request('OPTIONS', { origin: ORIGIN }), res);

    const allowedHeaders = res.headers['access-control-allow-headers'] ?? '';
    expect(allowedHeaders).toContain('Authorization');
    expect(allowedHeaders).toContain('Content-Type');
    expect(allowedHeaders).toContain('x-idempotency-key');
  });
});
