'use client';

import { useMemo, useState, useEffect, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { SessionCard, type SessionAction } from './SessionCard';
import { FilterBar, type FilterKey } from './FilterBar';
import type {
  CalendarDay,
  CharterEntry,
  DashboardSnapshot,
  LearnerBookingView,
} from '../../lib/dashboard/types';
import { callApi } from '../../lib/api-client';
import { fetchMyBookings } from '../../lib/dashboard/api-my-bookings';

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
  const [reviewBooking, setReviewBooking] = useState<LearnerBookingView | null>(null);
  const [noShowBooking, setNoShowBooking] = useState<LearnerBookingView | null>(null);

  useEffect(() => {
    // Hydrate real learner bookings from GET /api/classes/bookings/me
    fetchMyBookings()
      .then((real) => {
        if (real && real.length > 0) {
          setBookings(real);
        }
      })
      .catch(() => {});
  }, []);

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

  function executeAction(action: SessionAction) {
    setPendingBookingId(action.bookingId);
    if (action.type === 'reportNoShow') {
      callApi(`/classes/bookings/${action.bookingId}/no-show`, { method: 'POST' }).catch((err) => {
        console.warn('Backend POST /classes/bookings/:id/no-show error or mock booking', err);
      });
    }
    startAction(() => {
      // Optimistic local update + reconciled backend state
      setBookings((prev) => applyAction(prev, action));
      setPendingBookingId(null);
    });
  }

  function onAction(action: SessionAction) {
    if (action.type === 'confirm' && !action.rating) {
      const b = bookings.find((item) => item.id === action.bookingId);
      if (b) {
        setReviewBooking(b);
        return;
      }
    }
    if (action.type === 'reportNoShow' && !action.confirmed) {
      const b = bookings.find((item) => item.id === action.bookingId);
      if (b) {
        setNoShowBooking(b);
        return;
      }
    }
    executeAction(action);
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
      {liveBooking && (filter === 'all' || filter === 'upcoming') && (
        <SessionCardSlot
          booking={liveBooking}
          onAction={onAction}
          pending={pendingAction && pendingBookingId === liveBooking.id}
        />
      )}
      {sessionBookings.length === 0 && <EmptyState />}
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

      {reviewBooking && (
        <ReviewModal
          booking={reviewBooking}
          onClose={() => setReviewBooking(null)}
          onSubmit={(rating, comment) => {
            onAction({
              type: 'confirm',
              bookingId: reviewBooking.id,
              rating,
              comment,
            });
            setReviewBooking(null);
          }}
        />
      )}

      {noShowBooking && (
        <NoShowModal
          booking={noShowBooking}
          onClose={() => setNoShowBooking(null)}
          onConfirm={() => {
            onAction({
              type: 'reportNoShow',
              bookingId: noShowBooking.id,
              confirmed: true,
            });
            setNoShowBooking(null);
          }}
        />
      )}
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

function EmptyState() {
  const tEmpty = useTranslations('Dashboard.empty');
  const locale = useLocale();

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-12 text-center shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      <h2 className="text-base font-bold text-ink">{tEmpty('title')}</h2>
      <p className="max-w-md text-sm leading-relaxed text-ink-soft">{tEmpty('body')}</p>
      <a
        href={`/${locale}/classes`}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span>{tEmpty('cta')}</span>
      </a>
    </div>
  );
}

function ReviewModal({
  booking,
  onClose,
  onSubmit,
}: {
  booking: LearnerBookingView;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
}) {
  const tModal = useTranslations('Dashboard.reviewModal');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="review-modal-title" className="text-lg font-bold text-ink">
              {tModal('title')}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              {tModal('subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tModal('cancel')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Class summary badge */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-mist p-3 text-xs">
          <div className="flex flex-col">
            <span className="font-bold text-ink">{booking.classTitle}</span>
            <span className="text-ink-soft">{booking.teacherName} • {booking.teacherSchoolLabel}</span>
          </div>
          <div className="text-right">
            <span className="font-bold text-emerald-700">{booking.priceCredits} credits</span>
            <div className="text-[10px] font-medium text-slate-400">~{(booking.priceCredits * 1000).toLocaleString('vi-VN')}đ</div>
          </div>
        </div>

        {/* Rating star picker */}
        <div className="mt-5">
          <label className="mb-2 block text-xs font-semibold text-ink">
            {tModal('ratingLabel')}
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => {
              const active = (hoverRating || rating) >= star;
              return (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1 transition-transform hover:scale-110 focus:outline-hidden"
                  aria-label={`${star} star`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-7 w-7 transition-colors ${
                      active ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'
                    }`}
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
              );
            })}
            <span className="ml-2 text-xs font-semibold text-amber-600">
              {tModal('starHint', { rating })}
            </span>
          </div>
        </div>

        {/* Feedback comment input */}
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold text-ink">
            {tModal('commentLabel')}
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={tModal('commentPlaceholder')}
            className="w-full resize-none rounded-xl border border-border bg-surface p-3 text-xs text-ink placeholder:text-slate-400 focus:border-emerald-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-600"
          />
        </div>

        {/* Academic integrity pledge callout */}
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-900">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-emerald-600">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p className="leading-relaxed">{tModal('pledge')}</p>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex flex-col-reverse justify-end gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-surface px-5 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            {tModal('cancel')}
          </button>
          <button
            type="button"
            onClick={() => onSubmit(rating, comment)}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{tModal('submit')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function NoShowModal({
  booking,
  onClose,
  onConfirm,
}: {
  booking: LearnerBookingView;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const tNoShow = useTranslations('Dashboard.noShowModal');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="noshow-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs transition-opacity"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <h3 id="noshow-modal-title" className="text-base font-bold text-ink">
              {tNoShow('title')}
            </h3>
            <span className="text-xs font-medium text-rose-600">
              {tNoShow('subtitle')}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border bg-mist p-3 text-xs">
          <span className="font-bold text-ink">{booking.classTitle}</span>
          <div className="mt-0.5 text-ink-soft">{booking.teacherName} • {booking.teacherSchoolLabel}</div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-ink-soft">
          {tNoShow('body')}
        </p>

        <div className="mt-6 flex flex-col-reverse justify-end gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-surface px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            {tNoShow('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-rose-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-rose-700 active:scale-95"
          >
            {tNoShow('confirm')}
          </button>
        </div>
      </div>
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
            rating: action.rating ?? 5,
            body: action.comment?.trim() || 'Buổi học hoàn tất xuất sắc theo đúng cam kết thời gian và nội dung.',
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
