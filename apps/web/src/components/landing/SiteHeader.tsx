import { Link } from '../../i18n/routing';
import { BrandMark } from '../BrandMark';
import { LandingAuthAction } from './LandingAuthAction';

/**
 * Sticky site header (DESIGN.md §5 Navigation).
 *
 * - Slim white surface over mist, hairline border-bottom, logo/wordmark left,
 *   locale-aware links right in Label type.
 * - Hover -> ink-muted; active route gets ink weight (handled per-link).
 * - Tap targets >= 44px on mobile (p-2 + text-base).
 *
 * The primary action is auth-aware (see LandingAuthAction): the marketplace is
 * an authenticated screen, so a guest is routed to sign-in with a returnUrl
 * instead of being dropped into the unauth state. The locale switcher lives in
 * the footer.
 */
export function SiteHeader({ locale }: { locale: string }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 lg:px-8">
        {/* Brand wordmark — shared with the post-auth Navbar via BrandMark */}
        <Link
          href="/"
          aria-label="SkillSwap"
          className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-campus-emerald/40"
        >
          <BrandMark />
        </Link>

        {/* Primary nav (md+) + auth-aware action.
            `exploreHref` is locale-less: next-intl's Link prefixes the locale
            itself, and `returnUrl` is rebuilt from the locale inside the
            action. Passing `/${locale}/classes` here produced /en/en/classes. */}
        <nav aria-label="Primary" className="flex items-center gap-2">
          <LandingAuthAction exploreHref="/classes" locale={locale} />
        </nav>
      </div>
    </header>
  );
}
