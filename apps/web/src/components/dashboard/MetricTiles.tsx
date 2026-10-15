'use client';

import { useTranslations } from 'next-intl';
import type { LearnerMetrics } from '../../lib/dashboard/types';

export function MetricTiles({ metrics }: { metrics: LearnerMetrics }) {
  const t = useTranslations('Dashboard.metrics');
  const hoursPct =
    metrics.monthlyTargetHours > 0
      ? Math.min(100, Math.round((metrics.totalCompletedHours / metrics.monthlyTargetHours) * 100))
      : 0;
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
    <dl className="workspace-metrics">
      {items.map((item) => (
        <div key={item.label} className="workspace-metric-card">
          <dt className="workspace-metric-heading">
            <span>{item.label}</span>
          </dt>
          <dd className="workspace-metric-value">
            <span className="workspace-metric-number">{item.value}</span>
            {item.unit && <span className="text-sm text-ink-soft">{item.unit}</span>}
          </dd>
          <dd className="workspace-metric-hint">{item.hint}</dd>
        </div>
      ))}
    </dl>
  );
}
