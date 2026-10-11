'use client';

import { useMemo, useState, useTransition } from 'react';
import { SessionCard, type SessionAction } from './SessionCard';
import { FilterBar, type FilterKey } from './FilterBar';
import type {
  CalendarDay,
  CharterEntry,
  DashboardSnapshot,
  LearnerBookingView,
} from '../../lib/dashboard/types';

interface Props {
  initial: DashboardSnapshot;
  calendar: CalendarDay[];
  charter: CharterEntry[];
  isAuthed: boolean;
}

/**
 * Client-side shell for the learner dashboard (FR-021).
 *
 * Owns the bookings state, the filter state, and the side-effect
 * stubs (confirm / reportNoShow / rebook). All heavy lifting stays
 * on the server: this shell is a thin presentational controller
 * that re-renders when filter/search changes.
 */
export function DashboardShell({ initial, calendar, charter, isAuthed }: Props) {
  void calendar;
  void charter;
  void isAuthed;
  const [bookings, setBookings] = useState<LearnerBookingView[]>(
    initial.bookings,
  );
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [pendingAction, startAction] = useTransition();
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);

  const visibleBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (filter !== 'all' && !matchesFilter(b, filter)) return false;
      if (search.trim().length === 0) return true;
      const needle = search.trim().toLowerCase();
      return (
        b.classTitle.toLowerCase().includes(needle) ||
        b.teacherName.toLowerCase().includes(needle) ||
        b.teacherSchoolLabel.toLowerCase().includes(needle)
      );
    });
  }, [bookings, filter, search]);

  const liveBooking = bookings.find((b) => b.state === 'in_progress') ?? null;
  const sessionBookings = visibleBookings.filter(
    (b) => b.state !== 'in_progress',
  );

  function onAction(action: SessionAction) {
    setPendingBookingId(action.bookingId);
    startAction(() => {
      // Optimistic local update. The real adapter would POST to the
      // gateway and reconcile on response.
      setBookings((prev) => applyAction(prev, action));
      setPendingBookingId(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        bookings={bookings}
        onChange={({ filter: nextFilter, search: nextSearch }) => {
          setFilter(nextFilter);
          setSearch(nextSearch);
        }}
      />
      {liveBooking && (
        <SessionCardSlot
          booking={liveBooking}
          onAction={onAction}
          pending={pendingAction && pendingBookingId === liveBooking.id}
        />
      )}
      {sessionBookings.length === 0 && (
        <EmptyState
          title="No matching sessions"
          body="Try a different filter or clear the search input."
          cta="Browse classes"
        />
      )}
      <div className="flex flex-col gap-6">
        {sessionBookings.map((b) => (
          <SessionCardSlot
            key={b.id}
            booking={b}
            onAction={onAction}
            pending={pendingAction && pendingBookingId === b.id}
          />
        ))}
      </div>
    </div>
  );
}

function SessionCardSlot({
  booking,
  onAction,
  pending,
}: {
  booking: LearnerBookingView;
  onAction: (action: SessionAction) => void;
  pending: boolean;
}) {
  void pending;
  return <SessionCard booking={booking} onAction={onAction} />;
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
      <h2 className="text-base font-bold text-ink">{title}</h2>
      <p className="text-sm text-ink-soft">{body}</p>
      <a
        href="../classes"
        className="mt-2 inline-flex items-center gap-1 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-ink-soft"
      >
        {cta}
      </a>
    </div>
  );
}

/* --- Local helpers --- */

function matchesFilter(b: LearnerBookingView, filter: FilterKey): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'upcoming':
      return b.state === 'upcoming';
    case 'actionRequired':
      return b.state === 'pending_learner_confirmation';
    case 'completed':
      return b.state === 'completed' || b.state === 'released';
    case 'canceled':
      return (
        b.state === 'cancelled' ||
        b.state === 'refunded' ||
        b.state === 'no_show_reported'
      );
  }
}

function applyAction(
  prev: LearnerBookingView[],
  action: SessionAction,
): LearnerBookingView[] {
  return prev.map((b) => {
    if (b.id !== action.bookingId) return b;
    switch (action.type) {
      case 'confirm':
        return {
          ...b,
          state: 'completed',
          reviewSubmitted: {
            rating: 5,
            body: 'Demo confirmation body — replaced by real review later.',
            submittedOn: new Date().toISOString(),
          },
          receiptId: b.receiptId ?? `rcpt-demo-${b.id.slice(-4)}`,
        };
      case 'reportNoShow':
        return {
          ...b,
          state: 'no_show_reported',
          receiptId: b.receiptId ?? `rcpt-demo-${b.id.slice(-4)}`,
        };
      case 'cancel':
        return {
          ...b,
          state: 'cancelled',
          receiptId: b.receiptId ?? `rcpt-demo-${b.id.slice(-4)}`,
        };
      case 'rebook':
        // Rebook is a navigation action in the real app; here it
        // is a no-op so the optimistic update is a no-op too.
        return b;
    }
  });
}
