'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { CalendarDay } from '../../lib/dashboard/types';

/**
 * Mini academic calendar (FR-021 dashboard).
 *
 * 42-cell grid (6 weeks x 7 days, Monday-first). Today's cell is highlighted
 * with the primary background; 'live today' and 'booked' cells are decorated
 * with status dots. The prev/next arrows are plain <a href> links carrying
 * ?month=X&year=Y in the URL so navigation works without JS.
 *
 * Client component: the day flags are derived from the live bookings fetched by
 * `DashboardShell`, so the grid cannot be built on the server.
 */
export function MiniCalendar({
  month,
  year,
  days,
}: {
  month: number; // 0-11
  year: number; // e.g. 2025
  days: CalendarDay[];
}) {
  const t = useTranslations('Dashboard.calendar');
  const locale = useLocale() as 'vi' | 'en';
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  });
  const weekdays = t.raw('weekdays') as string[];

  const prev = prevMonth(month, year);
  const next = nextMonth(month, year);

  return (
    <article className="workspace-panel">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-bold text-ink">
          <CalendarMonthIcon className="h-5 w-5 text-ink" />
          <span>{monthLabel}</span>
        </h3>
        <div className="flex items-center gap-1">
          <a
            href={`?month=${prev.month}&year=${prev.year}`}
            aria-label={t('prev')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-mist hover:text-ink"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </a>
          <a
            href={`?month=${next.month}&year=${next.year}`}
            aria-label={t('next')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-mist hover:text-ink"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </a>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-sm text-ink-soft">
        {weekdays.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {days.map((day) => {
          const cellDate = new Date(day.date);
          const dayNum = cellDate.getUTCDate();
          const baseClasses = 'relative flex items-center justify-center py-1.5 rounded-lg';
          if (!day.inMonth) {
            return (
              <span key={day.date} aria-hidden="true" className={`${baseClasses} text-ink-soft/60`}>
                {dayNum}
              </span>
            );
          }
          if (day.isToday) {
            return (
              <span
                key={day.date}
                className={`${baseClasses} bg-ink font-bold text-surface `}
                aria-current="date"
              >
                {dayNum}
                {(day.hasLiveSession || day.hasBookedSession) && (
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-danger-ink" />
                )}
              </span>
            );
          }
          if (day.hasLiveSession) {
            return (
              <span key={day.date} className={`${baseClasses} bg-mist font-semibold text-ink`}>
                {dayNum}
                <span className="absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-danger-ink" />
              </span>
            );
          }
          if (day.hasBookedSession) {
            return (
              <span key={day.date} className={`${baseClasses} bg-mist font-semibold text-ink`}>
                {dayNum}
                <span className="absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-success-ink" />
              </span>
            );
          }
          return (
            <span key={day.date} className={`${baseClasses} text-ink`}>
              {dayNum}
            </span>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger-ink" />
          <span>{t('legendLive')}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-success-ink" />
          <span>{t('legendBooked')}</span>
        </span>
      </div>
    </article>
  );
}

function prevMonth(month: number, year: number) {
  if (month === 0) return { month: 11, year: year - 1 };
  return { month: month - 1, year };
}

function nextMonth(month: number, year: number) {
  if (month === 11) return { month: 0, year: year + 1 };
  return { month: month + 1, year };
}

/* --- Inline SVG glyphs --- */

function CalendarMonthIcon({ className = '' }: { className?: string }) {
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
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}

function ChevronLeftIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
