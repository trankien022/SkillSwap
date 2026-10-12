'use client';

import { useTranslations } from 'next-intl';
import { MAX_CAPACITY, MIN_CAPACITY, type ClassDraft } from '../../lib/teacher/types';

interface Props {
  draft: ClassDraft;
  onChange: (next: Partial<ClassDraft>) => void;
}

/**
 * Section 3: schedule & capacity.
 *
 * - Date + time are native <input type="date|time"> so the
 *   browser handles the i18n for the picker UI.
 * - Capacity is a small stepper with a hard 1..15 clamp; the
 *   `−` is disabled at 1, the `+` is disabled at 15.
 * - The badge text below the stepper reads "1-on-1 mentoring
 *   model" when capacity === 1, "Group class (N learners)"
 *   otherwise.
 */
export function ScheduleCapacitySection({ draft, onChange }: Props) {
  const t = useTranslations('Teacher.publish.schedule');
  const isOneOnOne = draft.capacity === 1;
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">{t('title')}</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-success-tint px-2.5 py-1 text-[11px] font-semibold text-success-ink">
          <EventAvailableIcon className="h-3.5 w-3.5" />
          <span>{t('noConflict')}</span>
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="class-date"
            className="text-sm font-semibold text-ink"
          >
            {t('dateLabel')}
          </label>
          <input
            id="class-date"
            type="date"
            value={draft.startsOn}
            onChange={(e) => onChange({ startsOn: e.target.value })}
            className="w-full rounded-lg border border-border bg-mist px-4 py-2.5 text-base text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-ink"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="class-time"
            className="text-sm font-semibold text-ink"
          >
            {t('timeLabel')}
          </label>
          <input
            id="class-time"
            type="time"
            value={draft.startsAt}
            onChange={(e) => onChange({ startsAt: e.target.value })}
            className="w-full rounded-lg border border-border bg-mist px-4 py-2.5 text-base text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-ink"
          />
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border bg-mist p-4">
        <div>
          <span className="block text-sm font-bold text-ink">
            {t('capacityLabel')}
          </span>
          <span className="block text-[11px] font-semibold text-success-ink">
            {isOneOnOne
              ? t('capacityBadge1to1')
              : t('capacityBadgeGroup', { count: draft.capacity })}
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 shadow-sm">
          <button
            type="button"
            aria-label="decrement capacity"
            disabled={draft.capacity <= MIN_CAPACITY}
            onClick={() =>
              onChange({ capacity: Math.max(MIN_CAPACITY, draft.capacity - 1) })
            }
            className="flex h-8 w-8 items-center justify-center rounded text-ink-soft transition-colors hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RemoveIcon className="h-4 w-4" />
          </button>
          <span className="w-8 text-center text-lg font-bold text-ink">
            {draft.capacity}
          </span>
          <button
            type="button"
            aria-label="increment capacity"
            disabled={draft.capacity >= MAX_CAPACITY}
            onClick={() =>
              onChange({ capacity: Math.min(MAX_CAPACITY, draft.capacity + 1) })
            }
            className="flex h-8 w-8 items-center justify-center rounded text-ink-soft transition-colors hover:bg-mist disabled:cursor-not-allowed disabled:opacity-40"
          >
            <AddIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-mist p-2.5">
        <VerifiedIcon className="h-4 w-4 text-ink-soft" />
        <span className="text-[11px] text-ink-soft">{t('conflictHelp')}</span>
      </div>
    </section>
  );
}

function EventAvailableIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <polyline points="9 16 11 18 15 14" />
    </svg>
  );
}

function AddIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function RemoveIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function VerifiedIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}