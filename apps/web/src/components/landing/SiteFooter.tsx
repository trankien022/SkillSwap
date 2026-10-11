import { getTranslations } from 'next-intl/server';

/**
 * Minimalist footer (DESIGN.md §5 Navigation mobile + footer pattern).
 *
 * - Mist background, hairline border-top.
 * - Brand tagline + copyright, center links, locale switcher placeholder.
 * - Phase 3 will replace the locale switcher placeholder with a real
 *   next-intl navigation swap. Pilot keeps it as read-only display.
 */
export async function SiteFooter() {
  const t = await getTranslations('Landing.footer');

  return (
    <footer className="w-full border-t border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-8 text-sm text-ink-soft lg:flex-row lg:px-8">
        {/* Brand + tagline */}
        <div className="flex flex-col items-center gap-1 text-center sm:flex-row sm:gap-2 sm:text-left">
          <span className="text-base font-bold tracking-tight text-ink">
            SkillSwap
          </span>
          <span className="hidden sm:inline">—</span>
          <span>{t('tagline')}</span>
        </div>

        {/* Quick links */}
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold uppercase tracking-wider"
        >
          <a
            href="#"
            aria-disabled="true"
            className="rounded-sm transition-colors hover:text-ink"
          >
            {t('links.escrow')}
          </a>
          <span aria-hidden="true" className="text-ink-muted">
            •
          </span>
          <a
            href="#"
            aria-disabled="true"
            className="rounded-sm transition-colors hover:text-ink"
          >
            {t('links.terms')}
          </a>
          <span aria-hidden="true" className="text-ink-muted">
            •
          </span>
          <a
            href="#"
            aria-disabled="true"
            className="rounded-sm transition-colors hover:text-ink"
          >
            {t('links.transparency')}
          </a>
        </nav>

        {/* Locale switcher placeholder (Phase 3 replaces this) */}
        <div
          aria-label={t('langLabel')}
          role="group"
          className="inline-flex items-center gap-1 rounded-full bg-neutral-tint p-1 text-xs font-semibold"
        >
          <span
            aria-pressed="true"
            className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-surface"
          >
            <span>{t('vi')}</span>
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span
            aria-pressed="false"
            className="rounded-full px-3 py-1 text-ink-soft"
          >
            {t('en')}
          </span>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-6 text-center text-xs text-ink-muted lg:px-8">
        © {new Date().getFullYear()} SkillSwap MVP
      </div>
    </footer>
  );
}