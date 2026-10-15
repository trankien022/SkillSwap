'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { formatStartsAt, hoursUntilBookingDeadline } from '../../lib/marketplace/mock-data';
import type { MarketplaceClass } from '../../lib/marketplace/types';

export function ClassCard({ item }: { item: MarketplaceClass }) {
  const t = useTranslations('Marketplace.card');
  const locale = useLocale() as 'vi' | 'en';

  const weekday = formatStartsAt(item.startsAt, locale);
  const time = new Date(item.startsAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const hoursLeft = hoursUntilBookingDeadline(item.startsAt);
  const vnd = (item.priceCredits * 1000).toLocaleString(locale);

  const art =
    item.skillCategory === 'programming'
      ? 'programming'
      : item.skillCategory === 'design'
        ? 'design'
        : item.skillCategory === 'language'
          ? 'languages'
          : 'peer-learning';

  return (
    <article className="workspace-class-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 text-sm text-ink-soft">
        <span className="font-medium">
          {t(item.format === 'one-on-one' ? 'format.oneOnOne' : 'format.group')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {t('duration', { minutes: item.durationMinutes })}
        </span>
      </div>
      <figure className="workspace-class-art">
        <Image
          src={`/learning/${art}.webp`}
          alt=""
          width={800}
          height={533}
          sizes="(max-width: 767px) 100vw, 50vw"
        />
        <figcaption>{t('illustration')}</figcaption>
      </figure>
      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-5">
        {/* Schedule row */}
        <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink-soft">
          <span>{t('startsAt', { when: weekday, time })}</span>
          <span className="text-ink-muted">•</span>
          <span className="font-normal text-ink-soft">{t('deadline', { hours: hoursLeft })}</span>
        </div>

        {/* Title. Absent when the API is the class-detail route, which does not
            return a skill name; the description below stands on its own. */}
        {item.skillName !== null && (
          <h3 className="text-xl font-semibold leading-snug tracking-tight text-ink">
            {item.skillName}
          </h3>
        )}

        {/* Teacher card */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-tint text-sm font-semibold text-ink"
            aria-hidden="true"
          >
            {item.teacherName.charAt(0).toUpperCase()}
          </div>
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium text-ink">{item.teacherName}</span>
              {item.verified === true && (
                <span className="inline-flex items-center gap-1 text-sm text-success-ink">
                  <CheckIcon className="h-4 w-4 shrink-0" />
                  <span>{t('verified')}</span>
                </span>
              )}
            </div>
            {/* School and level are omitted when absent; the catalogue sends
                them, the class-detail route does not. */}
            {(item.schoolName !== null || item.level !== null) && (
              <div className="flex items-center gap-1.5">
                {item.schoolName !== null && (
                  <span className="truncate text-sm text-ink-soft">{item.schoolName}</span>
                )}
                {item.level !== null && (
                  <span className="shrink-0 rounded bg-neutral-tint px-1.5 py-0.5 text-sm font-semibold text-ink-soft">
                    {t(`levels.${item.level}`)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-ink-soft">
          <StarIcon className="h-3.5 w-3.5 text-ink-muted" />
          {item.ratingAvg === null ? (
            t('noRating')
          ) : (
            <>
              <span className="font-semibold text-ink">{item.ratingAvg.toFixed(2)}</span>
              <span>({item.ratingCount})</span>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-sm font-medium text-ink-soft">
              <span>
                {item.availableSeats == null
                  ? t('availabilityUnknown')
                  : t('availability', { free: item.availableSeats, capacity: item.capacity })}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-1">
              <span className="text-lg font-bold text-ink">
                {t('price.credits', { credits: item.priceCredits })}
              </span>
              <span className="text-sm text-ink-soft">
                {item.format === 'group-2-4'
                  ? t('pricePerLearner', {
                      vnd,
                    })
                  : t('price.vnd', { vnd })}
              </span>
            </div>
          </div>
          <a href={`/${locale}/classes/${item.id}`} className="workspace-secondary">
            <span>{t('viewClass')}</span>
          </a>
        </div>
      </div>
    </article>
  );
}

/* --- Inline SVG glyphs --- */

function StarIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" />
    </svg>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
