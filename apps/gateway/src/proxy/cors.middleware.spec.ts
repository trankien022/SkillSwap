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
      request('OPTIONS', {
        origin: ORIGIN,
        'access-control-request-method': 'GET',
      }),
      res,
    );

    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(nextCalled).toBe(false);
  });

  it('does not swallow an OPTIONS that is not a preflight', () => {
    // Regression: the middleware used to end every OPTIONS with 204, so an
    // ordinary OPTIONS carrying no Access-Control-Request-Method — or one from
    // an origin that is not allow-listed — was silently answered instead of
    // being routed.
    const res = new MockResponse();
    const { nextCalled } = run(
      corsMiddleware([ORIGIN]),
      request('OPTIONS', { origin: ORIGIN }),
      res,
    );

    expect(res.ended).toBe(false);
    expect(nextCalled).toBe(true);
  });

  it('answers a preflight from a non-allow-listed origin without CORS headers', () => {
    // The browser must get a definitive answer it can reject. Forwarding the
    // preflight to the proxy would be worse: it carries no token, and a 502
    // from an unreachable API would be a misleading reason to block.
    const res = new MockResponse();
    const { nextCalled } = run(
      corsMiddleware([ORIGIN]),
      request('OPTIONS', {
        origin: 'http://evil.test',
        'access-control-request-method': 'GET',
      }),
      res,
    );

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(nextCalled).toBe(false);
  });

  it('allows the headers the clients actually send', () => {
    const res = new MockResponse();
    run(
      corsMiddleware([ORIGIN]),
      request('OPTIONS', {
        origin: ORIGIN,
        'access-control-request-method': 'GET',
      }),
      res,
    );

    const allowedHeaders = res.headers['access-control-allow-headers'] ?? '';
    expect(allowedHeaders).toContain('Authorization');
    expect(allowedHeaders).toContain('Content-Type');
    expect(allowedHeaders).toContain('x-idempotency-key');
  });
});
