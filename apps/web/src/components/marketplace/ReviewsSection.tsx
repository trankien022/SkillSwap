'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { ClassDetailView, ReviewView } from '../../lib/marketplace/types';

/**
 * Reviews section (FR-006 detail / FR-013).
 *
 * Two-column grid of review cards. When the class has no review data yet
 * (the live API exposes none), a neutral empty state is rendered instead
 * of inventing reviewers or quotes. The auto-verified note is generic —
 * no "trusted by X" wording, no fake reviewer names.
 */
export function ReviewsSection({ item }: { item: ClassDetailView }) {
  const t = useTranslations('ClassDetail.reviews');
  const locale = useLocale() as 'vi' | 'en';
  const reviews = item.reviews;
  const count = item.ratingCount;

  return (
    <section className="workspace-panel">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mist text-ink">
            <RateReviewIcon className="h-5 w-5" />
          </span>
          <h2 className="text-base font-semibold text-ink">{t('title')}</h2>
        </div>
        <span className="text-sm font-semibold text-ink-soft">{t('all', { count })}</span>
      </div>
      {reviews.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-mist p-6 text-center text-sm text-ink-soft">
          {t('empty')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              autoVerifiedLabel={t('autoVerified')}
              locale={locale}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewCard({
  review,
  autoVerifiedLabel,
  locale,
}: {
  review: ReviewView;
  autoVerifiedLabel: string;
  locale: 'vi' | 'en';
}) {
  const dateText = new Date(review.attendedOn).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return (
    <article className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-mist p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-sm font-bold text-ink">
              {review.authorName.split(' ').slice(-1)[0]?.charAt(0)?.toUpperCase() ?? 'D'}
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-ink">{review.authorName}</span>
              {/* The API returns no school for a reviewer, so the line is
                  omitted rather than filled with a stand-in. */}
              {review.schoolName !== null && (
                <span className="text-sm text-ink-soft">{review.schoolName}</span>
              )}
            </div>
          </div>
          <StarsRow rating={review.rating} />
        </div>
        <p className="text-sm italic text-ink-soft">"{review.body}"</p>
      </div>
      <span className="text-sm text-ink-soft">
        {dateText} • {autoVerifiedLabel}
      </span>
    </article>
  );
}

function StarsRow({ rating }: { rating: number }) {
  return (
    <div className="flex text-warning-ink">
      {Array.from({ length: 5 }).map((_, idx) => (
        <StarIcon key={idx} filled={idx < rating} className="h-4 w-4" />
      ))}
    </div>
  );
}

function StarIcon({ filled, className = '' }: { filled: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill={filled ? 'currentColor' : 'none'}
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

function RateReviewIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 5h18v12H7l-4 4z" />
    </svg>
  );
}
