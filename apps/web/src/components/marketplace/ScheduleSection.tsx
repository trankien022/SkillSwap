'use client';

import { useLocale, useTranslations } from 'next-intl';
import { formatSeats, hoursUntilBookingDeadline } from '../../lib/marketplace/mock-data';
import type { ClassDetailView } from '../../lib/marketplace/types';

/**
 * Schedule + capacity + room section (FR-006 detail).
 *
 * Two cards on md+, one column on mobile. The first card surfaces the
 * 24-hour booking rule copy without exposing 'BR-021' as an identifier.
 * The second card surfaces capacity (AC-028/029) and the E2EE infra
 * requirement (BR-018) without naming it.
 */
export function ScheduleSection({ item }: { item: ClassDetailView }) {
  const t = useTranslations('ClassDetail.schedule');
  const locale = useLocale() as 'vi' | 'en';
  const hoursLeft = hoursUntilBookingDeadline(item.startsAt);
  const [taken, capacity] = formatSeats(item.format, item.capacity)
    .split('/')
    .map((n) => Number(n));
  const isFull = taken >= capacity;
  const dateText = new Date(item.startsAt).toLocaleDateString(locale, {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeText = new Date(item.startsAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <section className="workspace-panel rounded-xl border border-border bg-surface p-6 ">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mist text-ink">
            <CalendarClockIcon className="h-5 w-5" />
          </span>
          <h2 className="text-base font-semibold text-ink">{t('title')}</h2>
        </div>
        <span className="rounded-lg border border-campus-emerald/20 bg-success-tint px-2 py-1 text-sm font-semibold text-campus-emerald-deep">
          {t('policyBadge')}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Time card */}
        <article className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-mist p-4">
          <div className="flex items-center gap-1 text-sm font-semibold r text-ink-soft">
            <ScheduleIcon className="h-4 w-4" />
            <span>{t('kickoff')}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-ink">{dateText}</span>
            <span className="text-sm font-semibold text-ink">
              {timeText} • {item.durationMinutes} phút
            </span>
          </div>
          <div
            className={
              hoursLeft <= 0
                ? 'inline-flex w-fit items-center gap-1.5 rounded-lg bg-danger-tint px-2 py-1 text-sm font-semibold text-danger-ink '
                : 'inline-flex w-fit items-center gap-1.5 rounded-lg bg-surface px-2 py-1 text-sm font-semibold text-success-ink '
            }
          >
            <TimerIcon className="h-3.5 w-3.5" />
            <span>
              {t('deadlinePrefix', { hours: hoursLeft })} — {t('deadlinePolicy')}
            </span>
          </div>
        </article>

        {/* Capacity + room card */}
        <article className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-mist p-4">
          <div className="flex items-center gap-1 text-sm font-semibold r text-ink-soft">
            <GroupIcon className="h-4 w-4" />
            <span>{t('capacity')}</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold text-ink">
                {item.format === 'one-on-one' ? t('oneOnOne') : t('group')}
              </span>
              <span
                className={
                  isFull
                    ? 'rounded-full bg-danger-tint px-2 py-0.5 text-sm font-bold text-danger-ink'
                    : 'rounded-full border border-success-tint bg-success-tint px-2 py-0.5 text-sm font-bold text-success-ink'
                }
              >
                {t('seatsLeft', { taken, capacity })}
              </span>
            </div>
            <span className="text-sm text-ink-soft">
              {item.format === 'one-on-one' ? t('oneOnOneLimit') : t('groupLimit')}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-ink-soft">
            <VideoCameraIcon className="h-4 w-4 text-campus-emerald" />
            <span>{t('room')}</span>
          </div>
        </article>
      </div>
    </section>
  );
}

/* --- Inline SVG glyphs --- */

function CalendarClockIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <circle cx="17" cy="15" r="3" />
      <line x1="17" y1="14" x2="17" y2="16" />
    </svg>
  );
}

function ScheduleIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function TimerIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 6v6l3 2" />
      <circle cx="12" cy="14" r="8" />
      <line x1="9" y1="3" x2="15" y2="3" />
    </svg>
  );
}

function GroupIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function VideoCameraIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}