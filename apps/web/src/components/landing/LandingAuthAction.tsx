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
 * The token read is client-only, matching how the rest of the app resolves a
 * session (tokens live in web storage, never on the server), so the server
 * renders the guest state and the client corrects it after mount.
 */
export function LandingAuthAction({ exploreHref }: { exploreHref: string }) {
  const t = useTranslations('Landing.nav');
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(Boolean(getTokens()));
  }, []);

  const signInHref = `/auth?tab=login&returnUrl=${encodeURIComponent(exploreHref)}`;

  return (
    <>
      <Link
        href={signedIn ? exploreHref : signInHref}
        className="rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-neutral-tint hover:text-ink"
      >
        {t('explore')}
      </Link>
      <a
        href="#trust"
        className="hidden rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-neutral-tint hover:text-ink md:inline-block"
      >
        {t('standard')}
      </a>
      {!signedIn && (
        <Link
          href={signInHref}
          className="hidden rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 sm:inline-flex"
        >
          {t('signIn')}
        </Link>
      )}
    </>
  );
}
