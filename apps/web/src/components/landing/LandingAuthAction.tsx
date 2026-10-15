'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '../../i18n/routing';
import { getTokens } from '../../lib/api-client';

/**
 * The landing header's primary action, which depends on whether a session
 * exists.
 *
 * The landing page used to show "Explore classes" and a "Sign in" pill to
 * everyone. `GET /classes` requires authentication, so an anonymous visitor who
 * clicked Explore landed on a screen that immediately rendered its unauth state.
 *
 * Both states now keep the same destination but make the intent explicit:
 * a guest is sent to sign-in with a `returnUrl` back to the marketplace, which
 * AuthForm already honours. Sign-in is only reached when its route exists.
 *
 * Routing contract (this is subtle and was a real bug):
 *   - `Link` from `i18n/routing` is next-intl's locale-aware Link — it prefixes
 *     the locale itself. `exploreHref` must therefore be locale-LESS
 *     (`/classes`), or the locale is applied twice (`/en/en/classes`).
 *   - `returnUrl` is a raw path handed to the auth page for a later redirect;
 *     it is NOT passed through Link, so it must carry the locale explicitly.
 *
 * The token read is client-only, matching how the rest of the app resolves a
 * session (tokens live in web storage, never on the server), so the server
 * renders the guest state and the client corrects it after mount.
 */
export function LandingAuthAction({
  exploreHref,
  locale,
}: {
  /** Locale-less path, e.g. `/classes`. Link adds the locale prefix. */
  exploreHref: string;
  /** Active locale, used only to build the absolute `returnUrl`. */
  locale: string;
}) {
  const t = useTranslations('Landing.nav');
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(Boolean(getTokens()));
  }, []);

  const returnUrl = encodeURIComponent(`/${locale}${exploreHref}`);
  const signInHref = `/auth?tab=login&returnUrl=${returnUrl}`;

  return (
    <>
      {/* Marketplace entry. Locale-less: Link adds the prefix. Guests are routed
          through sign-in by the destination, not by hiding the control. */}
      <Link
        href={signedIn ? exploreHref : signInHref}
        className="inline-flex min-h-11 items-center rounded-md px-2 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-neutral-tint hover:text-ink"
      >
        {t('explore')}
      </Link>
      <a
        href="#trust"
        className="hidden min-h-11 items-center rounded-md px-2 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-neutral-tint hover:text-ink md:inline-flex"
      >
        {t('standard')}
      </a>
      {/* Guest: a sign-in pill that is visible at every width. It used to be
          `hidden ... sm:inline-flex`, which left phones (<640px) with no visible
          way to sign in — the primary action for a guest. It is also the only
          affordance that says the marketplace needs an account.
          Signed in: a My bookings pill (/my-bookings is the real post-auth hub;
          there is no /dashboard route), so the header is not a dead end once
          the sign-in link disappears. */}
      <Link
        href={signedIn ? `/my-bookings` : signInHref}
        className="inline-flex shrink-0 items-center rounded-full bg-emerald-600 min-h-11 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
      >
        {signedIn ? t('myBookings') : t('signIn')}
      </Link>
    </>
  );
}
