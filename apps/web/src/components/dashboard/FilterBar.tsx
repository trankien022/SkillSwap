'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState, useTransition } from 'react';
import type { LearnerBookingView } from '../../lib/dashboard/types';

export type FilterKey = 'all' | 'upcoming' | 'actionRequired' | 'completed' | 'canceled';

const FILTERS: FilterKey[] = ['all', 'upcoming', 'actionRequired', 'completed', 'canceled'];

/** Filter bar for the dashboard session list (FR-021).
 *
 * Five lifecycle tabs with live counts + a search input. Pure
 * client component. Filtering happens in the parent shell so this
 * component only owns the UI state.
 */
export function FilterBar({
  bookings,
  onChange,
}: {
  bookings: LearnerBookingView[];
  onChange: (state: { filter: FilterKey; search: string }) => void;
}) {
  const t = useTranslations('Dashboard.filters');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();

  const counts = useMemo(() => {
    return {
      all: bookings.length,
      upcoming: bookings.filter((b) => b.state === 'upcoming').length,
      actionRequired: bookings.filter((b) => b.state === 'pending_learner_confirmation').length,
      completed: bookings.filter((b) => b.state === 'completed' || b.state === 'released').length,
      canceled: bookings.filter(
        (b) => b.state === 'cancelled' || b.state === 'refunded' || b.state === 'no_show_reported',
      ).length,
    };
  }, [bookings]);

  function setFilterAndNotify(next: FilterKey) {
    setFilter(next);
    startTransition(() => onChange({ filter: next, search }));
  }

  function setSearchAndNotify(next: string) {
    setSearch(next);
    startTransition(() => onChange({ filter, search: next }));
  }

  return (
    <div className="flex flex-col items-stretch justify-between gap-3 border-b border-border pb-4 2xl:flex-row 2xl:items-center">
      <div role="tablist" aria-label={t('all')} className="flex flex-wrap items-center gap-1">
        {FILTERS.map((key) => {
          const active = key === filter;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              aria-busy={isPending}
              onClick={() => setFilterAndNotify(key)}
              className={
                active
                  ? 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-surface shadow-sm transition-colors'
                  : 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-mist'
              }
            >
              <span>{t(key)}</span>
              <span
                className={
                  active
                    ? 'rounded-full bg-surface/20 px-1.5 py-0.5 text-[11px] font-semibold'
                    : 'rounded-full bg-mist px-1.5 py-0.5 text-[11px] font-semibold text-ink'
                }
              >
                {t('count', { count: counts[key] })}
              </span>
            </button>
          );
        })}
      </div>
      <div className="relative w-full shrink-0 2xl:w-64">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">
          <SearchIcon className="h-4 w-4" />
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearchAndNotify(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-lg border border-border bg-mist py-1.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink-soft focus:border-ink focus:bg-surface focus:outline-none"
        />
      </div>
    </div>
  );
}

function SearchIcon({ className = '' }: { className?: string }) {
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
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.5" y2="16.5" />
    </svg>
  );
}
