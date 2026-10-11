import { getTranslations } from 'next-intl/server';
import { Link } from '../../i18n/routing';

/**
 * Sticky site header (DESIGN.md §5 Navigation).
 *
 * - Slim white surface over mist, hairline border-bottom, logo/wordmark left,
 *   locale-aware links right in Label type.
 * - Hover -> ink-muted; active route gets ink weight (handled per-link).
 * - Tap targets >= 44px on mobile (p-2 + text-base).
 *
 * "Sign in" CTA links to a placeholder href in the MVP (no /auth/* route
 * exists yet). Phase 3 will wire the locale switcher here, and a later
 * increment will add the real /auth/register and /auth/login routes.
 */
export async function SiteHeader() {
  const t = await getTranslations('Landing.nav');

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-mist/90 backdrop-blur shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
        {/* Brand wordmark */}
        <Link
          href="/"
          aria-label="SkillSwap"
          className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-campus-emerald/40"
        >
          <span className="font-headline text-xl font-bold tracking-tight text-ink">
            SkillSwap
          </span>
        </Link>

        {/* Primary nav (md+) */}
        <nav
          aria-label="Primary"
          className="hidden items-center gap-2 md:flex"
        >
          <a
            href="#hero"
            className="rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-neutral-tint hover:text-ink"
          >
            {t('explore')}
          </a>
          <a
            href="#trust"
            className="rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-neutral-tint hover:text-ink"
          >
            {t('standard')}
          </a>
        </nav>

        {/* Right side: sign-in placeholder + avatar */}
        <div className="flex items-center gap-3">
          <a
            href="#"
            aria-disabled="true"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-neutral-tint hover:text-ink sm:inline-flex"
          >
            {t('signIn')}
          </a>
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink"
          >
            {/* inline person glyph — no icon library; 18px stroke */}
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-surface"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
            </svg>
          </span>
        </div>
      </div>
    </header>
  );
}