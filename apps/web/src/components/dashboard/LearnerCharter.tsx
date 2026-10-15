'use client';

import { useLocale, useTranslations } from 'next-intl';
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
export function LearnerCharter({ entries }: { entries: CharterEntry[] }) {
  const t = useTranslations('Dashboard.charter');
  const locale = useLocale();
  return (
    <article className="workspace-panel flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <GavelIcon className="h-5 w-5 text-ink" />
        <h3 className="text-base font-bold text-ink">{t('title')}</h3>
      </div>
      <div className="flex flex-col gap-2 text-sm">
        {entries.map((entry, idx) => (
          <CharterRule key={idx} entry={entry} />
        ))}
      </div>
      <a href={`/${locale}#trust`} className="workspace-link">
        {t('policyLink')}
        <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}

function CharterRule({ entry }: { entry: CharterEntry }) {
  const t = useTranslations('Dashboard.charter');
  const key =
    entry.icon === 'timer_off' ? 'noShow' : entry.icon === 'lock_person' ? 'contact' : null;
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-mist p-3">
      <span className="flex items-center gap-1 text-sm font-bold text-ink">
        <CharterIcon icon={entry.icon} className="h-4 w-4" />
        <span>{key ? t(`${key}.title`) : entry.title}</span>
      </span>
      <p className="text-sm leading-relaxed text-ink-soft">{key ? t(`${key}.body`) : entry.body}</p>
    </div>
  );
}

function CharterIcon({ icon, className = '' }: { icon: CharterEntry['icon']; className?: string }) {
  switch (icon) {
    case 'timer_off':
      return (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={className}
        >
          <circle cx="12" cy="13" r="8" />
          <path d="M9 5l6 0" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="5" y1="5" x2="2" y2="5" />
        </svg>
      );
    case 'lock_person':
      return (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={className}
        >
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          <circle cx="12" cy="16" r="1.5" />
        </svg>
      );
    case 'support_agent':
      return (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={className}
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
        </svg>
      );
    case 'gavel':
      return (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={className}
        >
          <path d="M14 4l6 6-4 4-6-6z" />
          <line x1="3" y1="21" x2="13" y2="11" />
        </svg>
      );
  }
}

function GavelIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M14 4l6 6-4 4-6-6z" />
      <line x1="3" y1="21" x2="13" y2="11" />
      <line x1="9" y1="7" x2="17" y2="15" />
    </svg>
  );
}
