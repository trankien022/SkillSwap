import { EventEmitter } from 'node:events';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { AppLogger } from '../shared/logger/app-logger';
import { createHttpLoggerOptions } from './http-logger-options';

class MockResponse extends EventEmitter {
  statusCode = 200;
  headersSent = true;
  private readonly headers: Record<string, string | string[]> = {};
  setHeader(name: string, value: string | string[]): this {
    this.headers[name] = value;
    return this;
  }
  getHeaders(): Record<string, string | string[]> { return { ...this.headers }; }
  end(): this { this.emit('finish'); return this; }
}

function createMockRequest(options: {
  method?: string; url?: string; headers?: Record<string, string | string[] | undefined>; id?: string;
}) {
  return {
    method: options.method ?? 'GET',
    url: options.url ?? '/api/auth/me',
    headers: options.headers ?? {},
    id: options.id,
    socket: { remoteAddress: '127.0.0.1', remotePort: 54321 },
  };
}

describe('http-logger-options middleware pipeline', () => {
  it('redacts tokens, cookies, and email while preserving observability and immutability', () => {
    const logs: string[] = [];
    const stream = { write: (chunk: string): void => { logs.push(chunk); } };
    const appLogger = new AppLogger('api-http', { logger: pino({ level: 'info' }, stream) });
    const middleware = pinoHttp(createHttpLoggerOptions(appLogger.raw));

    const fixtureBearer = 'Bearer disposable-jwt-token-val-998877';
    const fixtureCookie = 'session=disposable-cookie-session-445566';
    const fixtureEmail = 'disposable-alice@campus.example.test';
    const fixtureSetCookie = 'session=disposable-set-cookie-res-112233; Path=/; HttpOnly';
    const fixtureRequestId = 'req-trace-test-uuid-42';

    const mockReq = createMockRequest({
      method: 'POST',
      url: '/api/auth/me',
      id: fixtureRequestId,
      headers: {
        authorization: fixtureBearer,
        cookie: fixtureCookie,
        'x-user-email': fixtureEmail,
        'x-user-id': 'usr_disposable_user_1',
        'x-user-role': 'user',
        'content-type': 'application/json',
      },
    });

    const mockRes = new MockResponse().setHeader('set-cookie', fixtureSetCookie);
    middleware(mockReq as never, mockRes as never, () => {});
    mockRes.end();

    const raw = logs.join('');
    expect(raw).not.toContain('disposable-jwt-token-val-998877');
    expect(raw).not.toContain('disposable-cookie-session-445566');
    expect(raw).not.toContain('disposable-alice@campus.example.test');
    expect(raw).not.toContain('disposable-set-cookie-res-112233');

    const parsed = JSON.parse(logs[0]) as {
      req: { id: string; method: string; url: string; body?: unknown; headers: Record<string, unknown> };
      res: { statusCode: number; headers: Record<string, unknown> };
      responseTime: number;
    };

    expect(parsed.req.headers.authorization).toBe('[Redacted]');
    expect(parsed.req.headers.cookie).toBe('[Redacted]');
    expect(parsed.req.headers['x-user-email']).toBe('[Redacted]');
    expect(parsed.res.headers['set-cookie']).toBe('[Redacted]');
    expect(parsed.req.id).toBe(fixtureRequestId);
    expect(parsed.req.method).toBe('POST');
    expect(parsed.req.url).toBe('/api/auth/me');
    expect(parsed.req.headers['x-user-id']).toBe('usr_disposable_user_1');
    expect(parsed.req.headers['x-user-role']).toBe('user');
    expect(parsed.req.headers['content-type']).toBe('application/json');
    expect(parsed.res.statusCode).toBe(200);
    expect(typeof parsed.responseTime).toBe('number');
    expect(parsed.responseTime).toBeGreaterThanOrEqual(0);
    expect(parsed.req.body).toBeUndefined();
    expect(mockReq.headers.authorization).toBe(fixtureBearer);
  });

  it('covers case-sensitivity for capitalized and mixed-case headers', () => {
    const logs: string[] = [];
    const stream = { write: (chunk: string): void => { logs.push(chunk); } };
    const middleware = pinoHttp(createHttpLoggerOptions(pino({ level: 'info' }, stream)));

    const mockReq = createMockRequest({
      method: 'GET',
      url: '/api/auth/me',
      headers: {
        Authorization: 'Bearer disposable-cap-auth-778899',
        Cookie: 'sid=disposable-cap-cookie-223344',
        'X-User-Email': 'disposable-cap@campus.example.test',
        'X-User-Id': 'usr-disposable-cap-1',
      },
    });

    const mockRes = new MockResponse().setHeader('Set-Cookie', 'token=disposable-cap-set-cookie-556677; Path=/');
    middleware(mockReq as never, mockRes as never, () => {});
    mockRes.end();

    const raw = logs.join('');
    expect(raw).not.toContain('disposable-cap-auth-778899');
    expect(raw).not.toContain('disposable-cap-cookie-223344');
    expect(raw).not.toContain('disposable-cap@campus.example.test');
    expect(raw).not.toContain('disposable-cap-set-cookie-556677');

    const parsed = JSON.parse(logs[0]) as {
      req: { headers: Record<string, unknown> };
      res: { headers: Record<string, unknown> };
    };

    expect(parsed.req.headers.Authorization).toBe('[Redacted]');
    expect(parsed.req.headers.Cookie).toBe('[Redacted]');
    expect(parsed.req.headers['X-User-Email']).toBe('[Redacted]');
    expect(parsed.res.headers['Set-Cookie']).toBe('[Redacted]');
    expect(parsed.req.headers['X-User-Id']).toBe('usr-disposable-cap-1');
  });

  it('propagates x-request-id as req.id when id is not preset', () => {
    const logs: string[] = [];
    const stream = { write: (chunk: string): void => { logs.push(chunk); } };
    const middleware = pinoHttp(createHttpLoggerOptions(pino({ level: 'info' }, stream)));

    const mockReq = createMockRequest({
      method: 'GET',
      url: '/api/wallet/balance',
      headers: { 'x-request-id': 'custom-disposable-trace-id-100' },
    });

    const mockRes = new MockResponse();
    middleware(mockReq as never, mockRes as never, () => {});
    mockRes.end();

    const parsed = JSON.parse(logs[0]) as { req: { id: string } };
    expect(parsed.req.id).toBe('custom-disposable-trace-id-100');
  });

  it('redacts headers on 500 server error response paths', () => {
    const logs: string[] = [];
    const stream = { write: (chunk: string): void => { logs.push(chunk); } };
    const middleware = pinoHttp(createHttpLoggerOptions(pino({ level: 'info' }, stream)));

    const mockReq = createMockRequest({
      method: 'POST',
      url: '/api/wallet/balance',
      headers: { authorization: 'Bearer disposable-err-token-8899' },
    });

    const mockRes = new MockResponse();
    mockRes.statusCode = 500;
    mockRes.setHeader('set-cookie', 'err_session=disposable-err-cookie-1122; Path=/');

    middleware(mockReq as never, mockRes as never, () => {});
    mockRes.end();

    const raw = logs.join('');
    expect(raw).not.toContain('disposable-err-token-8899');
    expect(raw).not.toContain('disposable-err-cookie-1122');

    const parsed = JSON.parse(logs[0]) as {
      res: { statusCode: number; headers: Record<string, unknown> };
      req: { headers: Record<string, unknown> };
    };
    expect(parsed.res.statusCode).toBe(500);
    expect(parsed.res.headers['set-cookie']).toBe('[Redacted]');
    expect(parsed.req.headers.authorization).toBe('[Redacted]');
  });
});
