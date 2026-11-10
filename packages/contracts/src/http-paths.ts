/**
 * The shape of the HTTP surface, in one place.
 *
 * The gateway and the API each keep a public-path allow-list, and they had drifted
 * apart before: the gateway's copy carried a comment warning that a missing entry
 * "silently costs early class completion (AC-035)". Two hand-maintained copies of a
 * security list is the defect; this module is the single source both read.
 *
 * It lives in `packages/contracts` because both `apps/api` and `apps/gateway` already
 * depend on that package, and the architecture rules permit an app to import a
 * package (only packages may not import apps).
 */

/** Global prefix of the API. Also the mount point of the gateway's proxy. */
export const API_PREFIX = 'api';

/** The only version served today. */
export const API_VERSION = '1';

/** `api/v1` — the canonical, client-facing segment. */
export const API_VERSION_PREFIX = `${API_PREFIX}/v${API_VERSION}`;

/** A path as it appears on the wire, e.g. `/api/v1/classes`. */
export const API_BASE_PATH = `/${API_VERSION_PREFIX}`;

/**
 * Routes whose URL is owned by a system outside this repository, or by
 * infrastructure rather than a client.
 *
 * These must never gain a `/v1` segment:
 *
 * - `/wallet/top-ups/callback` — the SePay IPN URL is registered once in SePay's
 *   dashboard against a fixed tunnel. A new path silently stops payments settling.
 * - `/internal/jitsi` — the JaaS presence webhook URL is registered in the 8x8
 *   console. A new path silently stops presence arriving, which degrades class
 *   completion (AC-035).
 * - `/health` — a Render/Vercel probe, not a client contract.
 * - `/docs*` — the OpenAPI document describes *all* versions, so it is not itself
 *   versioned.
 *
 * These are declared `VERSION_NEUTRAL` on the routes themselves; this list is what
 * the gateway and the legacy-path rewrite consult.
 */
export const UNVERSIONED_PATH_PREFIXES = [
  '/api/health',
  '/api/docs',
  '/api/docs-json',
  '/api/wallet/top-ups/callback',
  '/api/internal/jitsi',
] as const;

/**
 * Routes reachable without a bearer token even when AUTH_REQUIRED=true (ADR-016),
 * plus the unversioned routes above.
 *
 * The list is written unversioned and matched through {@link normalizeApiPath}, so a
 * request to `/api/v1/...` and a legacy request to `/api/...` are both recognised
 * without a second copy of the entries.
 */
export const PUBLIC_PATH_PREFIXES = [
  '/api/health',
  '/api/docs',
  '/api/docs-json',
  // FR-001 / ADR-016: reachable before a session exists.
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  // FR-008 / ADR-017: the provider callback is authenticated by its HMAC, not a session.
  '/api/wallet/top-ups/callback',
  // FR-011 / FR-020 / ADR-039: the webhook cannot carry user headers; it is signed.
  '/api/internal/jitsi',
] as const;

/** Strip a trailing query/hash so path matching is not defeated by `?a=1`. */
function pathOnly(path: string): string {
  return path.split(/[?#]/)[0] ?? '';
}

/**
 * Remove the `/v1` segment so versioned and legacy paths compare equal:
 * `/api/v1/classes` → `/api/classes`, `/api/v1` → `/api`.
 *
 * Ordering matters — only the segment immediately after the prefix is the version,
 * so a resource that happens to be named `v1` is untouched.
 */
export function normalizeApiPath(path: string): string {
  const withoutVersion = path.replace(/^\/api\/v\d+(?=\/|$)/, '/api');
  return withoutVersion;
}

/** Whether `path` is already versioned (`/api/v1/...`). */
export function isVersionedPath(path: string): boolean {
  return /^\/api\/v\d+(?=\/|$)/.test(pathOnly(path));
}

/** Whether `path` belongs to a route that must keep its unversioned URL. */
export function isUnversionedPath(path: string): boolean {
  const candidate = normalizeApiPath(pathOnly(path));
  return UNVERSIONED_PATH_PREFIXES.some(
    (prefix) => candidate === prefix || candidate.startsWith(`${prefix}/`),
  );
}

/** Whether `path` may be requested without a bearer token. */
export function isPublicPath(path: string): boolean {
  const candidate = normalizeApiPath(pathOnly(path));
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => candidate === prefix || candidate.startsWith(`${prefix}/`),
  );
}

/**
 * The canonical versioned form of a legacy client path, or `null` to leave it alone.
 *
 * Returns `null` when the path is already versioned, is unversioned by design, or
 * does not sit under the API prefix at all.
 */
export function toVersionedPath(path: string): string | null {
  const [withoutSuffix, ...rest] = path.split(/(?=[?#])/);
  if (withoutSuffix === undefined) return null;

  if (withoutSuffix !== '/api' && !withoutSuffix.startsWith('/api/')) return null;
  if (isVersionedPath(withoutSuffix) || isUnversionedPath(withoutSuffix)) return null;

  const upgraded =
    withoutSuffix === '/api' ? API_BASE_PATH : `/${API_VERSION_PREFIX}${withoutSuffix.slice('/api'.length)}`;
  return rest.length > 0 ? `${upgraded}${rest.join('')}` : upgraded;
}
