/**
 * FR-008 / ADR-033: where SePay sends the payer back after checkout.
 *
 * The redirect URL is a *presentation* detail: settlement is decided by the
 * server-to-server IPN and the intent poll, never by the browser landing on a
 * page. It still must not become an open redirect, so a client-supplied value is
 * only accepted when it is one of ours:
 *
 *   - omitted             → the configured `SEPAY_RETURN_URL` (the web fallback)
 *   - any explicitly allowed browser origin → accepted (e.g. `/vi/payment/result`)
 *   - the mobile client's `skillswap:` scheme → accepted (app deep link)
 *   - anything else       → refused, never silently rewritten to ours, because a
 *                          silent rewrite would hide a bug from the client that
 *                          sent a URL the product would never accept
 *
 * The allowed origins are a fixed configuration list (plus `SEPAY_RETURN_URL`'s
 * own origin). They are never read from a request header — trusting `Origin`
 * would make this an open redirect.
 */
export const MOBILE_RETURN_URL_SCHEME = 'skillswap:';

export class ReturnUrlNotAllowedError extends Error {
  constructor(readonly submittedUrl: string) {
    super(
      'returnUrl is not allowed: it must use the ' +
        `${MOBILE_RETURN_URL_SCHEME} scheme or an origin listed in the wallet return-URL allow-list`,
    );
    this.name = 'ReturnUrlNotAllowedError';
  }
}

/** An origin this API may redirect a browser to, with any trailing slash removed. */
function normalizeOrigin(origin: string): string | null {
  const value = origin.trim();
  if (!value) return null;
  try {
    const parsed = new URL(value);
    // A URL without an origin (e.g. a custom scheme) cannot define a web
    // allow-list, and `origin === 'null'` would otherwise compare equal for
    // every such URL.
    if (!parsed.origin || parsed.origin === 'null') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * The browser origins a payer may be sent back to.
 *
 * The configured return URL's own origin is always included, so an
 * unconfigured list still means "exactly the origin we configured" — the extra
 * origins only ever widen it, and only where an operator wrote them down.
 */
export function allowedBrowserOrigins(
  configuredReturnUrl: string,
  extraOrigins: readonly string[],
): Set<string> {
  const origins = new Set<string>();
  const configured = normalizeOrigin(configuredReturnUrl);
  if (configured !== null) origins.add(configured);
  for (const extra of extraOrigins) {
    const normalized = normalizeOrigin(extra);
    if (normalized !== null) origins.add(normalized);
  }
  return origins;
}

/**
 * Resolves the URL to hand SePay for `success_url`/`error_url`/`cancel_url`.
 *
 * @throws ReturnUrlNotAllowedError when a client-supplied URL is not ours.
 */
export function resolveReturnUrl(
  submitted: string | undefined,
  configuredReturnUrl: string,
  extraOrigins: readonly string[] = [],
): string {
  if (submitted === undefined || submitted.trim() === '') {
    return configuredReturnUrl;
  }

  const candidate = submitted.trim();

  if (candidate.startsWith(MOBILE_RETURN_URL_SCHEME)) {
    // Deep links are opaque to us: `skillswap://wallet` is the app's wallet
    // screen. Only the scheme is trusted; the API never dereferences it.
    return candidate;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new ReturnUrlNotAllowedError(candidate);
  }

  if (!allowedBrowserOrigins(configuredReturnUrl, extraOrigins).has(parsed.origin)) {
    throw new ReturnUrlNotAllowedError(candidate);
  }

  return candidate;
}

/**
 * Attaches the invoice number to the return URL, so the page the payer lands on
 * can ask the server about *that* intent.
 *
 * The provider's redirect carries nothing else, and the intent id does not
 * exist when the form is submitted, so the invoice number — already the IPN's
 * correlation key — is the handle that travels.
 *
 * A custom-scheme URL (the mobile deep link) is returned unchanged: it is not a
 * web URL, the app reads its own state after the hand-off, and appending a
 * query to `skillswap://wallet` would change which screen the OS opens.
 */
export function withProviderRef(returnUrl: string, providerRef: string): string {
  if (returnUrl.startsWith(MOBILE_RETURN_URL_SCHEME)) {
    return returnUrl;
  }

  try {
    const url = new URL(returnUrl);
    url.searchParams.set('providerRef', providerRef);
    return url.toString();
  } catch {
    // `resolveReturnUrl` only ever returns a validated absolute URL or the
    // configured value, so this is unreachable in practice; returning the input
    // is preferred over inventing a URL the caller did not ask for.
    return returnUrl;
  }
}
