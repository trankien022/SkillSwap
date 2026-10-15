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
      {items.map((item, index) => (
        <div key={item.label} className="workspace-metric-card">
          <dt className="workspace-metric-heading">
            <span className="workspace-metric-icon">
              <MetricIcon index={index} />
            </span>
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

function MetricIcon({ index }: { index: number }) {
  const paths = [
    'M4 5h16v16H4z M8 3v4 M16 3v4 M4 10h16 M8 14h2 M14 14h2',
    'M4 6h16v14H4z M4 6V4h13v2 M15 11h5v4h-5z',
    'M12 7v5l3 2',
    'M5 3h14v18H5z M9 8h6 M9 12h6 M9 16h3',
  ];
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {index === 2 && <circle cx="12" cy="12" r="9" />}
      <path d={paths[index]} />
    </svg>
  );
}
