'use client';

import { useTranslations } from 'next-intl';
import type { LearnerMetrics } from '../../lib/dashboard/types';

/** Context for the class list; counts and money live in filters and the wallet. */
export function MetricTiles({ metrics }: { metrics: LearnerMetrics }) {
  const t = useTranslations('Dashboard.metrics');
  const items = [
    ...(metrics.upcomingCount > 0
      ? [{ label: t('upcoming'), value: t('upcomingHint', { when: metrics.nextSessionLabel }) }]
      : []),
    ...(metrics.totalCompletedHours > 0
      ? [{ label: t('hours'), value: `${metrics.totalCompletedHours} ${t('hoursUnit')}` }]
      : []),
    ...(metrics.pendingReviewCount > 0
      ? [{ label: t('review'), value: String(metrics.pendingReviewCount) }]
      : []),
  ];
  if (items.length === 0) return null;

  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-3 border-b border-border pb-4 text-sm">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-ink-soft">{item.label}</dt>
          <dd className="mt-1 font-medium text-ink [overflow-wrap:anywhere]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
