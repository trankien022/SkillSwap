'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  formatSeats,
  formatStartsAt,
  hoursUntilBookingDeadline,
} from '../../lib/marketplace/mock-data';
import type { MarketplaceClass } from '../../lib/marketplace/types';

/**
 * One marketplace class card (FR-006).
 *
 * Client component so it can be rendered inside the `MarketplaceClient`
 * shell without breaking the server/client boundary. The cover area is
 * a slate-to-mist gradient placeholder; no third-party CDN images.
 *
 * The 'Dữ liệu minh họa' badge renders only outside production builds.
 */
export function ClassCard({ item }: { item: MarketplaceClass }) {
  const t = useTranslations('Marketplace.card');
  const locale = useLocale() as 'vi' | 'en';
  const isDev = process.env.NODE_ENV !== 'production';

  const weekday = formatStartsAt(item.startsAt, locale);
  const time = new Date(item.startsAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const hoursLeft = hoursUntilBookingDeadline(item.startsAt);
  const vnd = (item.priceCredits * 1000).toLocaleString(locale);
  const [taken, capacity] = formatSeats(item.format, item.capacity)
    .split('/')
    .map((n) => Number(n));

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-campus-emerald/40 hover:shadow-md">
      {/* Cover area */}
      <div
        className="relative h-48 w-full overflow-hidden bg-mist"
        style={{
          backgroundImage: `linear-gradient(135deg, ${item.coverGradient.from}, ${item.coverGradient.to})`,
        }}
        role="img"
        aria-label={item.skillName}
      >
        {/* Top-left chips */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1">
          <span className="rounded-full bg-ink/90 px-2 py-0.5 text-[11px] font-semibold text-surface backdrop-blur-sm">
            {t(item.format === 'one-on-one' ? 'format.oneOnOne' : 'format.group')}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-surface/95 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-sm">
            <ClockIcon className="h-3 w-3 text-ink-soft" />
            {t('duration', { minutes: item.durationMinutes })}
          </span>
        </div>

        {/* Top-right rating pill */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded border border-border bg-surface/95 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-sm backdrop-blur-sm">
          <StarIcon className="h-3.5 w-3.5 text-warning-ink" />
          <span className="font-bold text-ink">
            {item.ratingAvg.toFixed(2)}
          </span>
          <span className="font-normal text-ink-soft">
            ({item.ratingCount})
          </span>
        </div>

        {/* Dev-only mock badge */}
        {isDev && (
          <span className="absolute right-3 top-3 rounded-full bg-warning-tint px-2 py-0.5 text-[10px] font-semibold text-warning-ink shadow-sm">
            {t('mockDataBadge')}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Schedule row */}
        <div className="flex items-center gap-1.5 text-xs font-medium text-campus-emerald">
          <CalendarIcon className="h-4 w-4" />
          <span>
            {t('startsAt', { when: weekday, time })}
          </span>
          <span className="text-ink-muted">•</span>
          <span className="font-normal text-ink-soft">
            {t('deadline', { hours: hoursLeft })}
          </span>
        </div>

        {/* Title */}
        <h3 className="line-clamp-2 text-base font-semibold text-ink transition-colors group-hover:text-campus-emerald">
          {item.skillName}
        </h3>

        {/* Teacher card */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-mist p-2">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-semibold text-surface"
            aria-hidden="true"
          >
            {item.teacherName.charAt(0).toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1 truncate">
              <span className="truncate text-sm font-medium text-ink">
                {item.teacherName}
              </span>
              {item.verified && (
                <CheckIcon className="h-4 w-4 shrink-0 text-success-ink" />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[11px] text-ink-soft">
                {item.schoolName}
              </span>
              <span className="shrink-0 rounded border border-success-tint bg-success-tint px-1.5 py-0.5 text-[10px] font-semibold text-success-ink">
                {item.level}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t border-border pt-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-success-ink">
              <GroupIcon className="h-3.5 w-3.5" />
              <span>
                {t('seats.format', { taken, capacity })}
              </span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="text-base font-bold text-ink">
                {t('price.credits', { credits: item.priceCredits })}
              </span>
              <span className="text-[11px] text-ink-soft">
                {item.format === 'group-2-4'
                  ? t('pricePerLearner', {
                      vnd: (
                        (item.priceCredits * 1000) /
                        item.capacity
                      ).toLocaleString(locale),
                    })
                  : t('price.vnd', { vnd })}
              </span>
            </div>
          </div>
          <a
            href={`/${locale}/classes/${item.id}`}
            className="flex items-center gap-1 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-surface transition-colors hover:bg-ink-soft"
          >
            <span>{t('viewClass')}</span>
            <ArrowForwardIcon className="h-4 w-4" />
          </a>
        </div>
      </div>
    </article>
  );
}

/* --- Inline SVG glyphs --- */

function ClockIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function StarIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" aria-hidden="true" className={className}>
      <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" />
    </svg>
  );
}

function CalendarIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
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

function GroupIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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