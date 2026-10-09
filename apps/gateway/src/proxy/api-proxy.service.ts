import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';
import type { Request, RequestHandler, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { GatewayConfig } from '../config/gateway-config';
import {
  AuthError,
  bearerToken,
  injectIdentityHeaders,
  stripIdentityHeaders,
  type GatewayIdentity,
} from './identity';
import { verifyBearerToken } from './jwt';

/** Routes reachable without a token even when AUTH_REQUIRED=true (ADR-016). */
const PUBLIC_PATHS = [
  '/api/health',
  '/api/docs',
  '/api/docs-json',
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
];

function isPublicPath(path: string): boolean {
  const withoutQuery = path.split('?')[0];
  return PUBLIC_PATHS.some(
    (prefix) => withoutQuery === prefix || withoutQuery.startsWith(`${prefix}/`),
  );
}

/**
 * The slice of http-proxy this service uses — narrow so tests can fake it.
 * Constructed in app.module.ts with the target from GatewayConfig.
 */
export interface ProxyLike {
  web(req: IncomingMessage, res: ServerResponse, options: { target: string }): void;
  on(
    event: 'error',
    listener: (error: Error, req: IncomingMessage, res: ServerResponse | Socket) => void,
  ): unknown;
  close(): void;
}

export class ApiProxyService implements OnModuleDestroy {
  readonly middleware: RequestHandler;
  readonly rateLimiter: RequestHandler;

  private readonly logger = new Logger(ApiProxyService.name);
  private readonly publicKey: string | undefined;

  constructor(
    private readonly config: GatewayConfig,
    private readonly proxy: ProxyLike,
  ) {
    if (config.authRequired) {
      try {
        this.publicKey = readFileSync(config.jwtPublicKeyPath, 'utf8');
      } catch {
        throw new Error(
          `JWT public key not readable at ${config.jwtPublicKeyPath} — run "pnpm keys:gen"`,
        );
      }
    }

    this.proxy.on('error', (error, _req, res) => this.onProxyError(error, res));

    this.rateLimiter = rateLimit({
      windowMs: config.rateLimitWindowMs,
      limit: config.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({ statusCode: 429, message: 'Too many requests' });
      },
    });

    this.middleware = (req: Request, res: Response): void => {
      // Identity headers are trusted only when we wrote them ourselves.
      stripIdentityHeaders(req.headers);
      let identity: GatewayIdentity | undefined;
      try {
        identity = this.authorize(req);
      } catch (error) {
        this.reject(res, error);
        return;
      }
      if (identity !== undefined) injectIdentityHeaders(req.headers, identity);

      // Mounting at "/api" strips the prefix from req.url; the API routes on it.
      if (req.originalUrl !== undefined) req.url = req.originalUrl;
      this.proxy.web(req, res, { target: this.config.apiInternalUrl });
    };
  }

  onModuleDestroy(): void {
    this.proxy.close();
  }

  private authorize(req: Request): GatewayIdentity | undefined {
    // AUTH_REQUIRED=false: dev mode — tokens are ignored, no headers injected.
    if (!this.config.authRequired) return undefined;
    // Routes that must stay reachable with auth on (health/docs + FR-001 entry).
    if (isPublicPath(req.originalUrl ?? req.path ?? req.url ?? '')) return undefined;
    const token = bearerToken(req.headers.authorization);
    if (token === undefined) throw new AuthError(401, 'Missing bearer token');
    if (this.publicKey === undefined) {
      throw new AuthError(500, 'JWT public key unavailable — run "pnpm keys:gen"');
    }
    return verifyBearerToken(token, this.publicKey);
  }

  private reject(res: Response, error: unknown): void {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ statusCode: error.statusCode, message: error.message });
      return;
    }
    this.logger.error(error instanceof Error ? error.message : String(error));
    res.status(500).json({ statusCode: 500, message: 'Internal gateway error' });
  }

  private onProxyError(error: Error, res: ServerResponse | Socket): void {
    this.logger.error(`Upstream request failed: ${error.message}`);
    if (!('writeHead' in res)) return;
    if (res.headersSent) {
      res.end();
      return;
    }
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end('{"statusCode":502,"message":"Upstream API unavailable"}');
  }
}
