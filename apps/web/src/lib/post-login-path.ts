/**
 * Where a freshly authenticated visitor lands (round-2 plan §4.1 / D1).
 *
 * Each role is sent to a page it can actually use: `/verifier` is guarded by
 * `GET /verifiers/me/queue`, the `/admin/*` screens answer 403 to anyone who
 * is not an admin, and `/classes` is the marketplace every role shares.
 * Before this existed, `AuthForm` hardcoded `/classes` for everyone, so an
 * admin or verifier signed in and landed on a marketplace with no way back to
 * their own work.
 */
export function postLoginPath(role: string | undefined, locale: string): string {
  if (role === 'admin') return `/${locale}/admin`;
  if (role === 'verifier') return `/${locale}/verifier`;
  return `/${locale}/classes`;
}

/**
 * Resolves the post-authentication redirect.
 *
 * An explicit `returnUrl` (the deep link the guest came from — landing CTAs,
 * the verifier status page, protected screens) always wins over the role
 * default, but only when it is a site-relative path: a full URL or a
 * protocol-relative `//host` would hand the redirect to an attacker-chosen
 * origin (open redirect), so those fall back to the role landing.
 */
export function resolvePostLoginPath(options: {
  role?: string | undefined;
  locale: string;
  returnUrl?: string | null;
}): string {
  const { role, locale, returnUrl } = options;
  if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
    return returnUrl;
  }
  return postLoginPath(role, locale);
}
