import { getLocale, getTranslations } from 'next-intl/server';
import type { ClassDetailView } from '../../lib/marketplace/types';
import { SKILL_CATEGORIES } from '../../lib/marketplace/types';

/**
 * Detail page hero (FR-006 detail).
 *
 * Renders the breadcrumb, the back link, and the hero card with format
 * + level + security chips, the title, the rating block, and the
 * teacher lead-in card. The dev-only "Dữ liệu minh họa" badge is
 * rendered when NODE_ENV !== 'production'.
 */
export async function DetailHeader({ item }: { item: ClassDetailView }) {
  const t = await getTranslations('ClassDetail.hero');
  const tBread = await getTranslations('ClassDetail.breadcrumb');
  const tBack = await getTranslations('ClassDetail');
  const locale = (await getLocale()) as 'vi' | 'en';
  const isDev = process.env.NODE_ENV !== 'production';

  // Map the kebab enum back to the camelCase i18n key (same lookup as
  // CategoryPills — kept inline to avoid coupling server components).
  const categoryI18nKey = categoryKey(item.skillCategory);
  const categoryLabel = (await getTranslations('Marketplace.categories'))(
    categoryI18nKey,
  );

  return (
    <>
      {/* Breadcrumb band */}
      <div className="w-full border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-3 md:flex-row md:items-center lg:px-8">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-1 text-sm text-ink-soft"
          >
            <a
              href={`/${locale}`}
              className="flex items-center gap-1 transition-colors hover:text-ink"
            >
              <HomeIcon className="h-4 w-4" />
              <span>{tBread('home')}</span>
            </a>
            <span aria-hidden="true" className="text-ink-muted">/</span>
            <a
              href={`/${locale}/classes`}
              className="transition-colors hover:text-ink"
            >
              {tBread('explore')}
            </a>
            <span aria-hidden="true" className="text-ink-muted">/</span>
            <a
              href={`/${locale}/classes?category=${item.skillCategory}`}
              className="transition-colors hover:text-ink"
            >
              {categoryLabel}
            </a>
            <span aria-hidden="true" className="text-ink-muted">/</span>
            <span className="max-w-xs truncate font-semibold text-ink md:max-w-sm">
              {item.skillName}
            </span>
          </nav>
          <a
            href={`/${locale}/classes`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
          >
            <ArrowBackIcon className="h-4 w-4" />
            <span>{tBack('backToList')}</span>
          </a>
        </div>
      </div>

      {/* Hero card */}
      <section className="relative overflow-hidden rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-campus-emerald-tint blur-2xl"
        />
        <div className="relative flex flex-col gap-4">
          {/* Tags */}
          <div className="flex flex-wrap items-center gap-2">
            <Chip>
              <PersonIcon className="h-3.5 w-3.5" />
              <span>
                {t(
                  item.format === 'one-on-one' ? 'format.oneOnOne' : 'format.group',
                )}
              </span>
            </Chip>
            <Chip variant="ink">
              <PsychologyIcon className="h-3.5 w-3.5" />
              <span>{t('levelBadge')}</span>
            </Chip>
            <Chip variant="success">
              <LockIcon className="h-3.5 w-3.5" />
              <span>{t('security')}</span>
            </Chip>
            {isDev && (
              <Chip variant="warning">
                <span>{t('mockBadge')}</span>
              </Chip>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
            {item.skillName}
          </h1>

          {/* Rating + completion row */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
            <div className="flex items-center gap-1 text-ink">
              <StarIcon className="h-4 w-4 text-warning-ink" />
              <span className="font-bold">{item.ratingAvg.toFixed(2)}</span>
              <span className="font-normal text-ink-soft">
                ({t('reviewsCount', { count: item.ratingCount })})
              </span>
            </div>
            <span aria-hidden="true" className="text-ink-muted">•</span>
            <div className="flex items-center gap-1">
              <CheckIcon className="h-4 w-4 text-campus-emerald" />
              <span>
                {t('completedLabel', { count: item.teacherStats.hoursTaught })}
              </span>
            </div>
          </div>

          {/* Teacher lead-in */}
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-border bg-mist p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div
                className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-semibold text-surface"
                aria-hidden="true"
              >
                {item.teacherName.charAt(0).toUpperCase()}
                {item.verified && (
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface shadow-sm">
                    <CheckIcon className="h-3.5 w-3.5 text-success-ink" />
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-ink">
                    {item.teacherName}
                  </span>
                  {item.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success-tint bg-success-tint px-2 py-0.5 text-[11px] font-semibold text-success-ink">
                      <SchoolIcon className="h-3 w-3" />
                      <span>{item.schoolName}</span>
                    </span>
                  )}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft">
                  <WorkspacePremiumIcon className="h-4 w-4 text-campus-emerald" />
                  <span>{item.teacherBio}</span>
                </p>
              </div>
            </div>
            <a
              href="#instructor-dossier"
              className="flex shrink-0 items-center gap-1 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
            >
              <span>{t('profileLink')}</span>
              <ArrowForwardIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

/* --- Chip helper --- */

function Chip({
  children,
  variant = 'neutral',
}: {
  children: React.ReactNode;
  variant?: 'neutral' | 'ink' | 'success' | 'warning';
}) {
  const map: Record<typeof variant, string> = {
    neutral: 'border-border bg-mist text-ink-soft',
    ink: 'border-ink/20 bg-ink/10 text-ink',
    success: 'border-success-tint bg-success-tint text-success-ink',
    warning: 'border-warning-tint bg-warning-tint text-warning-ink',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-semibold ${map[variant]}`}
    >
      {children}
    </span>
  );
}

/* --- Enum to i18n key (mirrors CategoryPills) --- */

function categoryI18nKey(category: ClassDetailView['skillCategory']): 'language' | 'programming' | 'design' | 'softSkills' | 'math' {
  switch (category) {
    case 'language':
      return 'language';
    case 'programming':
      return 'programming';
    case 'design':
      return 'design';
    case 'soft-skills':
      return 'softSkills';
    case 'math':
      return 'math';
  }
}

const categoryKey = categoryI18nKey;
// Reference SKILL_CATEGORIES to keep the import live for future derivations.
void SKILL_CATEGORIES;

/* --- Inline SVG glyphs --- */

function HomeIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 9l9-6 9 6v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2V9z" />
    </svg>
  );
}

function ArrowBackIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function PersonIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
    </svg>
  );
}

function PsychologyIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M9 4a4 4 0 0 0-4 4v2a3 3 0 0 0-2 3 3 3 0 0 0 2 3 4 4 0 0 0 4 4h1v-2" />
      <path d="M15 4a4 4 0 0 1 4 4v2a3 3 0 0 1 2 3 3 3 0 0 1-2 3 4 4 0 0 1-4 4h-1v-2" />
    </svg>
  );
}

function LockIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function StarIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" aria-hidden="true" className={className}>
      <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" />
    </svg>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SchoolIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 9l9-5 9 5-9 5-9-5z" />
      <path d="M7 11v5c2 1.5 4 1.5 5 1.5s3 0 5-1.5v-5" />
    </svg>
  );
}

function WorkspacePremiumIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 3l2.5 4.5 5 .5-3.5 3.5 1 5L12 14l-5 2.5 1-5L4.5 8l5-.5L12 3z" />
    </svg>
  );
}

function ArrowForwardIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}