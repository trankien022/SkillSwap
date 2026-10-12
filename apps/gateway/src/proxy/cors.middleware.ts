import type { RequestHandler } from 'express';

/**
 * Minimal CORS for browser clients (Expo Web) that call the gateway on a
 * different origin than the page.
 *
 * The Next.js application never needs this: `next.config.ts` rewrites `/api/*`
 * to the gateway, so the browser stays on its own origin. Expo Web has no such
 * proxy and calls the gateway directly, which the browser then blocks unless the
 * gateway answers with the right headers.
 *
 * Security: the allow-list is explicit and never `*`. The gateway injects
 * trusted identity headers downstream, so a wildcard would let any site drive
 * authenticated calls through it. `GatewayConfig` rejects `*` outright.
 *
 * Mount this first at the `/api` boundary: a preflight must succeed before the
 * rate limiter counts it and before the identity middleware inspects it.
 */
export function corsMiddleware(origins: readonly string[]): RequestHandler {
  const allowed = new Set(origins);

  return (req, res, next) => {
    const origin = req.headers.origin;

    if (typeof origin === 'string' && allowed.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Authorization,Content-Type,x-idempotency-key',
      );
      res.setHeader('Access-Control-Max-Age', '600');
    }

    // A preflight carries no token and no body, so it must not reach the proxy.
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    next();
  };
}
