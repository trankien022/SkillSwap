import { getTranslations, getLocale } from 'next-intl/server';

/**
 * Page header (FR-021 dashboard).
 *
 * Renders the role chip + term chip, the page H1, the subtitle, and
 * the action linking to the class catalogue.
 *
 * The KPI tiles that used to live in this file moved to `MetricTiles.tsx`:
 * they render live snapshot data, so they are now a client component mounted by
 * `DashboardShell` rather than a server component reading static fixtures.
 */
export async function DashboardHeader() {
  const t = await getTranslations('Dashboard.page');
  const locale = (await getLocale()) as 'vi' | 'en';

  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex max-w-3xl flex-col gap-2">
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-mist px-2.5 py-1 text-sm font-semibold text-ink">
            <SchoolIcon className="h-4 w-4" />
            <span>{t('roleChip')}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-mist px-2.5 py-1 text-xs font-semibold text-ink-soft">
            <span>{t('termChip')}</span>
          </span>
        </div>
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
          {t('title')}
        </h1>
        <p className="text-sm leading-relaxed text-ink-soft">{t('subtitle')}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <a
          href={`/${locale}/classes`}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          <SearchIcon className="h-4 w-4" />
          <span>{t('ctaExplore')}</span>
        </a>
      </div>
    </header>
  );
}

/* --- Inline SVG glyphs (header only) --- */

function SchoolIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 9l9-5 9 5-9 5-9-5z" />
      <path d="M7 11v5c2 1.5 4 1.5 5 1.5s3 0 5-1.5v-5" />
    </svg>
  );
}

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  );
}
