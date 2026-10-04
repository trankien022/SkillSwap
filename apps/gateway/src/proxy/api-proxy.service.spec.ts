import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Request, Response } from 'express';
import { sign } from 'jsonwebtoken';
import { GatewayConfig } from '../config/gateway-config';
import { ApiProxyService, type ProxyLike } from './api-proxy.service';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const otherKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherPrivatePem = otherKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

class FakeProxy implements ProxyLike {
  readonly forwarded: Array<{ target: string; url: string; headers: IncomingHttpHeaders }> = [];
  private readonly errorListeners: Array<
    (error: Error, req: IncomingMessage, res: ServerResponse | Socket) => void
  > = [];

  web(req: IncomingMessage, res: ServerResponse, options: { target: string }): void {
    this.forwarded.push({ target: options.target, url: req.url ?? '', headers: { ...req.headers } });
  }

  on(
    event: 'error',
    listener: (error: Error, req: IncomingMessage, res: ServerResponse | Socket) => void,
  ): unknown {
    if (event === 'error') this.errorListeners.push(listener);
    return this;
  }

  close(): void {
    // no resources to release in the fake
  }

  fail(error: Error, req: IncomingMessage, res: ServerResponse | Socket): void {
    for (const listener of this.errorListeners) listener(error, req, res);
  }
}

class MockResponse {
  statusCode = 200;
  body: unknown;
  headersSent = false;
  private readonly headers = new Map<string, string>();

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(payload: unknown): this {
    this.body = payload;
    return this;
  }

  setHeader(name: string, value: string): this {
    this.headers.set(name.toLowerCase(), String(value));
    return this;
  }

  getHeader(name: string): string | undefined {
    return this.headers.get(name.toLowerCase());
  }

  writeHead(code: number, headers: Record<string, string> = {}): this {
    this.statusCode = code;
    for (const [name, value] of Object.entries(headers)) this.setHeader(name, value);
    this.headersSent = true;
    return this;
  }

  end(chunk?: string): this {
    if (chunk !== undefined) this.body = chunk;
    this.headersSent = true;
    return this;
  }
}

function request(headers: Record<string, string | string[] | undefined> = {}): Request {
  return {
    method: 'GET',
    url: '/api/wallet-ledger/status',
    originalUrl: '/api/wallet-ledger/status',
    ip: '127.0.0.1',
    headers,
    app: { get: () => undefined },
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
}

function response(): { mock: MockResponse; res: Response } {
  const mock = new MockResponse();
  return { mock, res: mock as unknown as Response };
}

function createService(
  env: Record<string, string>,
  proxy: FakeProxy = new FakeProxy(),
): { service: ApiProxyService; proxy: FakeProxy } {
  return { service: new ApiProxyService(new GatewayConfig(env), proxy), proxy };
}

function validToken(): string {
  return sign({ sub: 'user-42', email: 'u@skillswap.dev', role: 'student' }, privatePem, {
    algorithm: 'RS256',
  });
}

describe('ApiProxyService', () => {
  let keyDir: string;
  let keyPath: string;

  beforeAll(() => {
    keyDir = mkdtempSync(join(tmpdir(), 'skillswap-gateway-'));
    keyPath = join(keyDir, 'jwt-public.pem');
    writeFileSync(keyPath, publicPem);
  });

  afterAll(() => {
    rmSync(keyDir, { recursive: true, force: true });
  });

  describe('header hygiene', () => {
    it('strips client-supplied identity headers before forwarding', () => {
      const { service: svc, proxy } = createService({});

      svc.middleware(
        request({ 'x-user-id': 'spoofed', 'x-user-email': 'evil@example.com', 'x-user-role': 'admin' }),
        response().res,
        jest.fn(),
      );

      expect(proxy.forwarded).toHaveLength(1);
      const headers = proxy.forwarded[0].headers;
      expect(headers['x-user-id']).toBeUndefined();
      expect(headers['x-user-email']).toBeUndefined();
      expect(headers['x-user-role']).toBeUndefined();
      expect(proxy.forwarded[0].target).toBe('http://localhost:4001');
    });

    it('restores the full /api path stripped by the mount point', () => {
      const { service: svc, proxy } = createService({});
      const req = request();
      req.url = '/wallet-ledger/status';
      req.originalUrl = '/api/wallet-ledger/status';

      svc.middleware(req, response().res, jest.fn());

      expect(proxy.forwarded[0].url).toBe('/api/wallet-ledger/status');
    });
  });

  describe('auth disabled (AUTH_REQUIRED=false)', () => {
    it('forwards without identity headers even when a token is sent', () => {
      const { service: svc, proxy } = createService({});

      svc.middleware(
        request({ authorization: `Bearer ${validToken()}` }),
        response().res,
        jest.fn(),
      );

      expect(proxy.forwarded).toHaveLength(1);
      const headers = proxy.forwarded[0].headers;
      expect(headers['x-user-id']).toBeUndefined();
      expect(headers['x-user-email']).toBeUndefined();
      expect(headers['x-user-role']).toBeUndefined();
      expect(headers.authorization).toBe(`Bearer ${validToken()}`);
    });
  });

  describe('auth enabled (AUTH_REQUIRED=true)', () => {
    const authEnv = { AUTH_REQUIRED: 'true' };

    it('rejects a request without a bearer token with 401', () => {
      const { service: svc, proxy } = createService({ ...authEnv, JWT_PUBLIC_KEY_PATH: keyPath });
      const { mock, res } = response();

      svc.middleware(request(), res, jest.fn());

      expect(mock.statusCode).toBe(401);
      expect(mock.body).toEqual({ statusCode: 401, message: 'Missing bearer token' });
      expect(proxy.forwarded).toHaveLength(0);
    });

    it('injects verified identity headers from a valid RS256 token', () => {
      const { service: svc, proxy } = createService({ ...authEnv, JWT_PUBLIC_KEY_PATH: keyPath });

      svc.middleware(request({ authorization: `Bearer ${validToken()}` }), response().res, jest.fn());

      expect(proxy.forwarded).toHaveLength(1);
      const headers = proxy.forwarded[0].headers;
      expect(headers['x-user-id']).toBe('user-42');
      expect(headers['x-user-email']).toBe('u@skillswap.dev');
      expect(headers['x-user-role']).toBe('student');
    });

    it('overwrites spoofed identity headers with the verified claims', () => {
      const { service: svc, proxy } = createService({ ...authEnv, JWT_PUBLIC_KEY_PATH: keyPath });

      svc.middleware(
        request({
          authorization: `Bearer ${validToken()}`,
          'x-user-id': 'spoofed',
          'x-user-role': 'admin',
        }),
        response().res,
        jest.fn(),
      );

      expect(proxy.forwarded[0].headers['x-user-id']).toBe('user-42');
      expect(proxy.forwarded[0].headers['x-user-role']).toBe('student');
    });

    it('rejects a malformed token with 401', () => {
      const { service: svc, proxy } = createService({ ...authEnv, JWT_PUBLIC_KEY_PATH: keyPath });
      const { mock, res } = response();

      svc.middleware(request({ authorization: 'Bearer not.a.token' }), res, jest.fn());

      expect(mock.statusCode).toBe(401);
      expect(mock.body).toEqual({ statusCode: 401, message: 'Invalid or expired token' });
      expect(proxy.forwarded).toHaveLength(0);
    });

    it('rejects a token signed by a different key with 401', () => {
      const { service: svc } = createService({ ...authEnv, JWT_PUBLIC_KEY_PATH: keyPath });
      const foreignToken = sign({ sub: 'user-42' }, otherPrivatePem, { algorithm: 'RS256' });
      const { mock, res } = response();

      svc.middleware(request({ authorization: `Bearer ${foreignToken}` }), res, jest.fn());

      expect(mock.statusCode).toBe(401);
      expect(mock.body).toEqual({ statusCode: 401, message: 'Invalid or expired token' });
    });

    it('rejects a token without a subject claim with 401', () => {
      const { service: svc } = createService({ ...authEnv, JWT_PUBLIC_KEY_PATH: keyPath });
      const noSub = sign({ role: 'student' }, privatePem, { algorithm: 'RS256' });
      const { mock, res } = response();

      svc.middleware(request({ authorization: `Bearer ${noSub}` }), res, jest.fn());

      expect(mock.statusCode).toBe(401);
      expect(mock.body).toEqual({
        statusCode: 401,
        message: 'Token is missing a subject claim (sub)',
      });
    });

    it('fails fast at startup when the public key file is missing', () => {
      expect(() =>
        createService({
          AUTH_REQUIRED: 'true',
          JWT_PUBLIC_KEY_PATH: join(keyDir, 'missing.pem'),
        }),
      ).toThrow('pnpm keys:gen');
    });
  });

  describe('upstream errors', () => {
    it('answers 502 when the API is unreachable', () => {
      const { service: svc, proxy } = createService({});
      const req = request();
      const { mock, res } = response();

      svc.middleware(req, res, jest.fn());
      proxy.fail(new Error('connect ECONNREFUSED 127.0.0.1:4001'), req, mock as unknown as ServerResponse);

      expect(mock.statusCode).toBe(502);
      expect(mock.body).toBe('{"statusCode":502,"message":"Upstream API unavailable"}');
    });
  });

  describe('rate limiting', () => {
    it('answers 429 once RATE_LIMIT_MAX is exceeded', async () => {
      const { service: svc } = createService({
        RATE_LIMIT_MAX: '2',
        RATE_LIMIT_WINDOW_MS: '60000',
      });
      const next = jest.fn();
      const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

      for (let i = 0; i < 2; i += 1) {
        const { mock, res } = response();
        svc.rateLimiter(request(), res, next);
        await flush();
        expect(mock.statusCode).toBe(200);
      }

      const { mock, res } = response();
      svc.rateLimiter(request(), res, next);
      await flush();

      expect(mock.statusCode).toBe(429);
      expect(mock.body).toEqual({ statusCode: 429, message: 'Too many requests' });
      expect(next).toHaveBeenCalledTimes(2);
    });
  });
});
