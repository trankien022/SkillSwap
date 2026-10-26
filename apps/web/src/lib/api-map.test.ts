import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Contract pinning for the web client (`RESTful-CONVENTIONS.md` §16).
 *
 * `docs/api/FRONTEND-API-MAP.md` lists every gateway route the web app calls.
 * Nothing else kept that list honest, so a route rename could ship with the
 * reference still naming the old path. This spec reads the sources and fails
 * when a `callApi(...)` literal is not on the map.
 */

const SRC_ROOT = join(__dirname, '..');

/**
 * Every route the web client is allowed to call, under the gateway `/api`
 * prefix. `:param` stands for one path segment.
 *
 * Keep this in step with `docs/api/FRONTEND-API-MAP.md`; the spec below checks
 * both directions — a source call missing here, and a route here that no
 * source still calls.
 */
const WEB_ROUTES = [
  '/admin-operation/dashboard',
  '/audit-log',
  '/auth/login',
  '/auth/logout',
  '/auth/me',
  '/auth/refresh',
  '/auth/register',
  '/classes',
  '/classes/:id',
  '/classes/:id/bookings',
  '/classes/:id/cancel',
  '/classes/:id/start',
  '/classes/bookings/:bookingId/confirm',
  '/classes/bookings/:bookingId/no-show',
  '/classes/bookings/:bookingId/rating',
  '/classes/bookings/:bookingId/room-access',
  '/classes/bookings/me',
  '/notifications',
  // FR-015 / ADR-037: the account-lock list and its two actions.
  '/operations/accounts',
  '/operations/accounts/:accountId/reinstatement',
  '/operations/accounts/:accountId/suspension',
  '/profile-skills/me',
  '/skill-evidence',
  '/skill-evidence/:id/claim',
  '/skill-evidence/:id/decision',
  '/skill-evidence/:id/history',
  '/skills',
  '/student-verifications',
  '/student-verifications/:id/decision',
  '/student-verifications/:id/revocation',
  '/student-verifications/documents',
  '/student-verifications/me',
  '/verifiers/:accountId/status',
  '/verifiers/admin/queue',
  '/verifiers/me/queue',
  '/wallet/balance',
  '/wallet/history',
  '/wallet/top-ups',
  '/wallet/top-ups/:id',
  '/wallet/top-ups/by-provider-ref/:providerRef',
] as const;

/** Files that call the gateway. Specs are excluded: they assert, they do not call. */
const SOURCE_EXCLUDES = /\.(test|spec)\.tsx?$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry) || SOURCE_EXCLUDES.test(entry)) return [];
    return [path];
  });
}

interface CallSite {
  readonly file: string;
  /** The raw literal or template tail as written in the source. */
  readonly literal: string;
}

/** `callApi('/x')`, `callApiOk('/x')`, and the wrapper's own `fetch(\`${API}/api/x\`)`. */
const CALL_MATCHER =
  /(?:callApiOk|callApi)\(\s*(?:'([^']*)'|`([^`]*)`|([A-Za-z_$][\w$.]*))|fetch\(\s*`\$\{API\}\/api(\/[^`]*)`/g;

/**
 * A `const`-bound path: `const path = \`/x${...}\`` or the common
 * `const path = qs ? \`/x?${qs}\` : '/x'`. The gateways hoist a query string
 * tail into a constant and pass the variable, so the scan resolves the
 * constant instead of demanding an inline literal.
 *
 * Resolution is positional — the nearest declaration *before* the use — because
 * every gateway method declares its own `path` and the last one wins otherwise.
 */
function declaredPaths(text: string): Array<{ name: string; at: number; value: string }> {
  const literal = String.raw`(?:'([^']*)'|\`([^\`]*)\`)`;
  // Take the first literal in the initialiser, whatever the expression around
  // it: `const path = '/x'`, `const path = qs ? \`/x?${qs}\` : '/x'`.
  const matcher = new RegExp(String.raw`const\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*?${literal}`, 'g');
  const declared: Array<{ name: string; at: number; value: string }> = [];
  for (const match of text.matchAll(matcher)) {
    const value = match[2] ?? match[3];
    if (value !== undefined && value.startsWith('/')) {
      declared.push({ name: match[1], at: match.index, value });
    }
  }
  return declared;
}

/** The last declaration of `name` that appears before `at`. */
function resolveDeclared(
  declared: Array<{ name: string; at: number; value: string }>,
  name: string,
  at: number,
): string | undefined {
  let found: string | undefined;
  for (const entry of declared) {
    if (entry.at >= at) break;
    if (entry.name === name) found = entry.value;
  }
  return found;
}

/**
 * Collects the first string argument of every gateway call. Handles a quoted
 * literal (`callApi('/auth/me')`) and a template literal
 * (``callApi(`/classes/${id}/start`)``); a bare identifier is resolved against
 * a `const` in the same file; anything else is reported so it can be reviewed
 * rather than silently skipped.
 */
function callSites(): CallSite[] {
  const sites: CallSite[] = [];
  for (const file of sourceFiles(SRC_ROOT)) {
    const text = readFileSync(file, 'utf8');
    const declared = declaredPaths(text);
    for (const match of text.matchAll(CALL_MATCHER)) {
      // `match[3]` is an identifier: it resolves to a literal `const` above.
      const identifier = match[3];
      const resolved =
        identifier === undefined
          ? (match[1] ?? match[2] ?? match[4])
          : resolveDeclared(declared, identifier, match.index);
      sites.push({
        file: relative(SRC_ROOT, file).split(sep).join('/'),
        literal: resolved ?? `<expression: ${identifier}>`,
      });
    }
  }
  return sites;
}

/** Turns a source literal into a `/api`-prefixed route with `:param` segments. */
function toRoute(literal: string): string | null {
  if (literal.startsWith('<expression:')) return null;
  const path = literal.split('?')[0];
  if (!path.startsWith('/')) return null;
  // Strip the query string: `?...` literal, or a template tail like
  // `${buildQuery(q)}` / `${qs}` that appends params. Only
  // `${encodeURIComponent(...)}` interpolations belong to the path itself.
  const withoutQuery = path
    .replace(/\?.*$/, '')
    .replace(/\$\{(?!encodeURIComponent\()[^}]*\}$/, '');
  const templated = withoutQuery.replace(/\$\{encodeURIComponent\([^)]*\)\}/g, ':param');
  const segments = templated
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      // A remaining interpolation is an id: template it.
      if (segment.includes('${')) return ':param';
      return segment;
    });
  return `/api/${segments.join('/')}`;
}

function normalise(route: string): string[] {
  return route.split('/').filter(Boolean).map((segment) => (segment.startsWith(':') ? ':param' : segment));
}

function sameRoute(a: string, b: string): boolean {
  const left = normalise(a);
  const right = normalise(b);
  return left.length === right.length && left.every((segment, i) => segment === right[i]);
}

describe('web API map', () => {
  const sites = callSites();

  it('finds the call sites it is meant to guard', () => {
    // Guards against the scan silently matching nothing after a refactor.
    expect(sites.length).toBeGreaterThan(30);
  });

  it('only calls documented routes', () => {
    const undocumented = sites
      .map((site) => ({ ...site, route: toRoute(site.literal) }))
      .filter((site) => site.route !== null)
      .filter((site) => !WEB_ROUTES.some((known) => sameRoute(`/api${known}`, site.route as string)))
      .map((site) => `${site.file}: ${site.literal}`);

    expect(undocumented).toEqual([]);
  });

  it('has no call site whose path is built from a dynamic expression', () => {
    // A route assembled from a variable cannot be checked by this spec, so it
    // must be passed to a helper with literal paths instead. The only exception
    // is `callApi`'s own retry, which re-passes the path it was handed.
    const dynamic = sites
      .filter((site) => site.literal.startsWith('<expression:'))
      .filter((site) => site.file !== 'lib/api-client.ts')
      .map((site) => `${site.file}: ${site.literal}`);

    expect(dynamic).toEqual([]);
  });

  it('lists no route that the client has stopped calling', () => {
    const called = new Set(
      sites
        .map((site) => toRoute(site.literal))
        .filter((route): route is string => route !== null),
    );
    const stale = WEB_ROUTES.filter(
      (known) => ![...called].some((route) => sameRoute(route, `/api${known}`)),
    );

    expect(stale).toEqual([]);
  });
});
