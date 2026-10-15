'use client';

import { useTranslations } from 'next-intl';
import type { LearnerMetrics } from '../../lib/dashboard/types';

export function MetricTiles({ metrics }: { metrics: LearnerMetrics }) {
  const t = useTranslations('Dashboard.metrics');
  const hoursPct = Math.min(
    100,
    Math.round((metrics.totalCompletedHours / metrics.monthlyTargetHours) * 100),
  );
  const items = [
    {
      label: t('upcoming'),
      value: metrics.upcomingCount,
      unit: '',
      hint: t('upcomingHint', { when: metrics.nextSessionLabel }),
    },
    {
      label: t('escrow'),
      value: metrics.escrowHeldCredits,
      unit: t('creditsUnit'),
      hint: t('escrowHint', { count: metrics.escrowHeldClassCount }),
    },
    {
      label: t('hours'),
      value: metrics.totalCompletedHours,
      unit: t('hoursUnit'),
      hint: t('hoursProgress', { pct: hoursPct }),
    },
    { label: t('review'), value: metrics.pendingReviewCount, unit: '', hint: t('reviewHint') },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border py-6 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-sm font-medium text-ink-soft">{item.label}</dt>
          <dd className="mt-2 flex flex-wrap items-baseline gap-1.5">
            <span className="text-3xl font-bold tracking-tight text-ink">{item.value}</span>
            <span className="text-xs text-ink-muted">{item.unit}</span>
          </dd>
          <dd className="mt-2 text-xs leading-relaxed text-ink-soft">{item.hint}</dd>
        </div>
      ))}
    </dl>
  );
}
