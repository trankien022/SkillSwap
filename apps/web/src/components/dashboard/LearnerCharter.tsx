'use client';

import { useTranslations } from 'next-intl';
import type { CharterEntry } from '../../lib/dashboard/types';

/**
 * Learner Charter widget (FR-021 dashboard / FR-038 escrow).
 *
 * Two rule cards from `CharterEntry[]`: the 15-minute teacher
 * no-show rule and the 'keep contact inside the platform' rule,
 * plus a 'Get academic help' button. No '5-minute response' SLA,
 * no 'Voucher 10 Credits' compensation, no 'SkillSwap Escrow'
 * branding.
 *
 * Client component so it can render inside the dashboard shell alongside the
 * other live widgets.
 */
export function LearnerCharter({
  entries,
}: {
  entries: CharterEntry[];
}) {
  const t = useTranslations('Dashboard.charter');
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <GavelIcon className="h-5 w-5 text-ink" />
        <h3 className="text-base font-bold text-ink">{t('title')}</h3>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        {entries.map((entry, idx) => (
          <CharterRule key={idx} entry={entry} />
        ))}
      </div>
      <button
        type="button"
        aria-disabled="true"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger-ink bg-mist py-2.5 text-sm font-semibold text-danger-ink transition-colors hover:bg-danger-tint"
      >
        <SupportAgentIcon className="h-4 w-4" />
        <span>{t('support')}</span>
      </button>
    </article>
  );
}

function CharterRule({ entry }: { entry: CharterEntry }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-mist p-3">
      <span className="flex items-center gap-1 text-sm font-bold text-ink">
        <CharterIcon icon={entry.icon} className="h-4 w-4" />
        <span>{entry.title}</span>
      </span>
      <p className="text-xs leading-relaxed text-ink-soft">{entry.body}</p>
    </div>
  );
}

function CharterIcon({
  icon,
  className = '',
}: {
  icon: CharterEntry['icon'];
  className?: string;
}) {
  switch (icon) {
    case 'timer_off':
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
          <circle cx="12" cy="13" r="8" />
          <path d="M9 5l6 0" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="5" y1="5" x2="2" y2="5" />
        </svg>
      );
    case 'lock_person':
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          <circle cx="12" cy="16" r="1.5" />
        </svg>
      );
    case 'support_agent':
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
        </svg>
      );
    case 'gavel':
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
          <path d="M14 4l6 6-4 4-6-6z" />
          <line x1="3" y1="21" x2="13" y2="11" />
        </svg>
      );
  }
}

function GavelIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M14 4l6 6-4 4-6-6z" />
      <line x1="3" y1="21" x2="13" y2="11" />
      <line x1="9" y1="7" x2="17" y2="15" />
    </svg>
  );
}

function SupportAgentIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l1.4-4.7A8.5 8.5 0 1 1 21 11.5z" />
    </svg>
  );
}