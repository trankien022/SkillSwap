'use client';

import { useTranslations } from 'next-intl';
import type { LearnerMetrics } from '../../lib/dashboard/types';

/**
 * The four KPI tiles at the top of the learner dashboard (FR-021).
 *
 * Client component: the metrics are part of the live snapshot fetched after
 * mount (`DashboardShell`), so they cannot be rendered on the server. Until the
 * fetch resolves the caller passes zeros, never fixtures.
 */
export function MetricTiles({ metrics }: { metrics: LearnerMetrics }) {
  const t = useTranslations('Dashboard.metrics');
  const hoursPct = Math.min(
    100,
    Math.round((metrics.totalCompletedHours / metrics.monthlyTargetHours) * 100),
  );
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Upcoming */}
      <MetricTile
        label={t('upcoming')}
        icon={<EventUpcomingIcon className="h-6 w-6" />}
        iconBg="primary-tint"
        iconColor="text-ink"
        body={
          <span className="text-2xl font-bold text-ink">
            {metrics.upcomingCount}
          </span>
        }
        footer={
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-ink">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success-ink" />
            <span>{t('upcomingHint', { when: metrics.nextSessionLabel })}</span>
          </span>
        }
      />

      {/* Escrow */}
      <MetricTile
        label={t('escrow')}
        icon={<LockClockIcon className="h-6 w-6" />}
        iconBg="success-tint"
        iconColor="text-success-ink"
        body={
          <span className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-ink">
              {metrics.escrowHeldCredits}
            </span>
            <span className="text-sm text-ink-soft">credits</span>
          </span>
        }
        footer={
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-ink">
            <VerifiedUserIcon className="h-3.5 w-3.5" />
            <span>
              {t('escrowHint', { count: metrics.escrowHeldClassCount })}
            </span>
          </span>
        }
      />

      {/* Hours learned */}
      <MetricTile
        label={t('hours')}
        icon={<HourglassIcon className="h-6 w-6" />}
        iconBg="mist"
        iconColor="text-ink-soft"
        body={
          <span className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-ink">
              {metrics.totalCompletedHours}
            </span>
            <span className="text-sm text-ink-soft">hours</span>
          </span>
        }
        footer={
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-mist">
              <div
                className="h-full rounded-full bg-ink"
                style={{ width: `${hoursPct}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-semibold text-ink">
              {t('hoursProgress', { pct: hoursPct })}
            </span>
          </div>
        }
      />

      {/* Pending review */}
      <MetricTile
        label={t('review')}
        icon={<RateReviewIcon className="h-6 w-6" />}
        iconBg="warning-tint"
        iconColor="text-warning-ink"
        body={
          <span className="text-2xl font-bold text-ink">
            {metrics.pendingReviewCount}
          </span>
        }
        footer={
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
            <StarsIcon className="h-3.5 w-3.5" />
            <span>{t('reviewHint')}</span>
          </span>
        }
      />
    </div>
  );
}

function MetricTile({
  label,
  icon,
  iconBg,
  iconColor,
  body,
  footer,
}: {
  label: string;
  icon: React.ReactNode;
  iconBg: 'primary-tint' | 'success-tint' | 'mist' | 'warning-tint';
  iconColor: string;
  body: React.ReactNode;
  footer: React.ReactNode;
}) {
  const bgMap: Record<typeof iconBg, string> = {
    'primary-tint': 'bg-campus-emerald-tint',
    'success-tint': 'bg-success-tint',
    mist: 'bg-mist',
    'warning-tint': 'bg-warning-tint',
  };
  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            {label}
          </span>
          <span className="mt-1">{body}</span>
        </div>
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${bgMap[iconBg]} ${iconColor}`}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-ink-soft">
        {footer}
      </div>
    </article>
  );
}

/* --- Inline SVG glyphs --- */

function EventUpcomingIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <circle cx="12" cy="15" r="2" />
    </svg>
  );
}

function LockClockIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16" r="2" />
    </svg>
  );
}

function HourglassIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M6 2h12M6 22h12" />
      <path d="M6 2c0 5 6 5 6 10s-6 5-6 10" />
      <path d="M18 2c0 5-6 5-6 10s6 5 6 10" />
    </svg>
  );
}

function RateReviewIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" />
    </svg>
  );
}

function VerifiedUserIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function StarsIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" className={className}>
      <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" />
    </svg>
  );
}
