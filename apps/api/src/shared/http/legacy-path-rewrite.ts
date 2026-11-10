import type { NextFunction, Request, Response } from 'express';
import { toVersionedPath } from '@skillswap/contracts';

/**
 * Serves the unversioned client paths while clients move to `/api/v1`.
 *
 * Introducing a version segment by breaking every deployed client in the same
 * commit defeats the purpose of versioning, so a request to a legacy client path is
 * rewritten to its canonical versioned form before Nest routes it. Paths that must
 * keep their URL — the SePay IPN, the JaaS presence webhook, health and the OpenAPI
 * doc — are excluded by `toVersionedPath`, which is where that policy lives.
 *
 * TODO(versioning): delete this once the web and mobile clients ship on v1. It
 * exists for one release only.
 */
export function legacyPathRewrite() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // `req.url` is the path the router will match, including its query string.
    const upgraded = toVersionedPath(req.url);
    if (upgraded !== null) {
      req.url = upgraded;
    }
    next();
  };
}
