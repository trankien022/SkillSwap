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
 *
 * Only a *real* preflight is short-circuited — an `OPTIONS` that carries both an
 * allow-listed `Origin` and the `Access-Control-Request-Method` header a browser
 * adds. Any other `OPTIONS` falls through to normal routing, so this middleware
 * never turns an unrelated request into an empty 204.
 */
export function corsMiddleware(origins: readonly string[]): RequestHandler {
  const allowed = new Set(origins);

  return (req, res, next) => {
    const origin = req.headers.origin;
    const originAllowed = typeof origin === 'string' && allowed.has(origin);

    if (originAllowed) {
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
    // It is identified by the browser's own marker header, which avoids
    // swallowing an unrelated OPTIONS that happens to carry an Origin.
    const isPreflight =
      req.method === 'OPTIONS' &&
      req.headers['access-control-request-method'] !== undefined;

    if (isPreflight) {
      res.statusCode = 204;
      res.end();
      return;
    }

    next();
  };
}
