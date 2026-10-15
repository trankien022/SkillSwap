'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { BookingState, LearnerBookingView, SkillIcon } from '../../lib/dashboard/types';

/**
 * Polymorphic session card (FR-021 booking lifecycle).
 *
 * Renders a single booking as one of the four lifecycle shapes the
 * dashboard surfaces: pending_learner_confirmation, upcoming,
 * completed, and the three "done" states (cancelled, refunded,
 * no_show_reported) which all collapse into a small closed card.
 *
 * Action buttons are wired by the parent `DashboardShell` (client)
 * via the `onAction` callback. The card itself is a client
 * component because it's mounted from the client shell that owns
 * the bookings state and the optimistic update reducer.
 */
export function SessionCard({
  booking,
  onAction,
}: {
  booking: LearnerBookingView;
  onAction?: (action: SessionAction) => void;
}) {
  const tCard = useTranslations('Dashboard.card');
  const tFilters = useTranslations('Dashboard.filters');

  switch (booking.state) {
    case 'pending_learner_confirmation':
      return <PendingCard booking={booking} onAction={onAction} tCard={tCard} />;
    case 'upcoming':
      return <UpcomingCard booking={booking} tCard={tCard} />;
    case 'completed':
    case 'released':
      return <CompletedCard booking={booking} onAction={onAction} tCard={tCard} />;
    case 'cancelled':
    case 'refunded':
    case 'no_show_reported':
      return <ClosedCard booking={booking} tCard={tCard} tFilters={tFilters} />;
    case 'in_progress':
      return <LiveCard booking={booking} tCard={tCard} />;
    default: {
      const _exhaustive: never = booking.state;
      void _exhaustive;
      return null;
    }
  }
}

export type SessionAction =
  | { type: 'confirm'; bookingId: string; rating?: number; comment?: string }
  | { type: 'reportNoShow'; bookingId: string; confirmed?: boolean }
  | { type: 'cancel'; bookingId: string }
  | { type: 'rebook'; bookingId: string };

type CardTranslator = ReturnType<typeof useTranslations<'Dashboard.card'>>;
type FiltersTranslator = ReturnType<typeof useTranslations<'Dashboard.filters'>>;

/* --- Sub-cards by lifecycle state --- */

function PendingCard({
  booking,
  onAction,
  tCard,
}: {
  booking: LearnerBookingView;
  onAction?: (action: SessionAction) => void;
  tCard: CardTranslator;
}) {
  const locale = useLocale();
  const countdown = booking.autoReleaseCountdownSeconds ?? 0;
  const hours = Math.floor(countdown / 3600);
  const minutes = Math.floor((countdown % 3600) / 60);
  return (
    <article className="workspace-panel relative overflow-hidden transition-shadow hover:">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-warning-ink" />
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="warning">
              <PendingIcon className="h-4 w-4" />
              <span>{tCard('pending')}</span>
            </Chip>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-danger-ink">
            <AlarmIcon className="h-3.5 w-3.5" />
            <span>
              {tCard('autoRelease', { time: `${hours}h:${String(minutes).padStart(2, '0')}m` })}
            </span>
          </span>
        </div>
        <CardBody booking={booking} tCard={tCard} />
        <RuleBox tCard={tCard} />
        <div className="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onAction?.({ type: 'reportNoShow', bookingId: booking.id })}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-rose-50/60 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 sm:w-auto"
          >
            <ReportIcon className="h-4 w-4" />
            <span>{tCard('noShow')}</span>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/${locale}/bookings/${booking.id}/review`}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <span>{locale === 'vi' ? 'Nghiệm thu chi tiết' : 'Detailed Settlement'}</span>
              <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                arrow_forward
              </span>
            </Link>
            <button
              type="button"
              onClick={() => onAction?.({ type: 'confirm', bookingId: booking.id })}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-campus-emerald-deep px-6 py-2.5 text-sm font-semibold text-white  transition-colors hover:bg-ink sm:w-auto"
            >
              <CheckCircleIcon className="h-4 w-4" />
              <span>{tCard('confirmReview')}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function UpcomingCard({ booking, tCard }: { booking: LearnerBookingView; tCard: CardTranslator }) {
  const locale = useLocale() as 'vi' | 'en';
  const [notice, setNotice] = useState<string | null>(null);
  const start = new Date(booking.startsAt);
  const hoursLeft = Math.max(0, Math.round((start.getTime() - Date.now()) / (60 * 60 * 1000)));
  const startText = start.toLocaleString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <article className="workspace-panel transition-shadow hover:">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="ink">
              <EventAvailableIcon className="h-4 w-4" />
              <span>
                {tCard('confirmedSlot')} - {tCard('confirmedSlotHint', { hours: hoursLeft })}
              </span>
            </Chip>
            <span className="text-sm text-ink-soft">
              {tCard('bookingId', { id: booking.id.split('-').slice(-1)[0] ?? booking.id })}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-success-ink">
            <LockIcon className="h-3.5 w-3.5" />
            <span>{tCard('escrowHeld', { credits: booking.priceCredits })}</span>
          </span>
        </div>
        <CardBody booking={booking} tCard={tCard} startText={startText} />
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-mist px-4 py-2.5 text-sm text-ink-soft">
          <LinkIcon className="h-4 w-4 text-ink" />
          <span>{tCard('roomUnavailable')}</span>
        </div>
        {notice && (
          <p role="status" className="workspace-feedback bg-neutral-tint text-ink-soft">
            {notice}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setNotice(tCard('chatHint'))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-mist px-3 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface"
            >
              <ChatIcon className="h-4 w-4" />
              <span>{tCard('chat')}</span>
            </button>
            <button
              type="button"
              onClick={() => setNotice(tCard('materialsHint'))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-mist px-3 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface"
            >
              <DownloadIcon className="h-4 w-4" />
              <span>{tCard('downloadNotes')}</span>
            </button>
          </div>
          <Link
            href={`/${locale}/bookings/${booking.id}/live`}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-surface px-4 py-2 text-sm font-semibold text-slate-700  transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <LockClockIcon className="h-4 w-4 text-emerald-600" />
            <span>{tCard('joinRoomSoon')}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

function CompletedCard({
  booking,
  onAction,
  tCard,
}: {
  booking: LearnerBookingView;
  onAction?: (action: SessionAction) => void;
  tCard: CardTranslator;
}) {
  const locale = useLocale() as 'vi' | 'en';
  const completedOn = booking.reviewSubmitted
    ? new Date(booking.reviewSubmitted.submittedOn).toLocaleDateString(locale, {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';
  return (
    <article className="workspace-panel transition-shadow hover:">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="success">
              <TaskAltIcon className="h-4 w-4" />
              <span>
                {tCard('completed')} - {tCard('completedReleased')}
              </span>
            </Chip>
            <span className="text-sm text-ink-soft">
              {tCard('bookingId', { id: booking.id.split('-').slice(-1)[0] ?? booking.id })}
            </span>
          </div>
          <span className="text-sm text-ink-soft">
            {tCard('completedOn', { when: completedOn })}
          </span>
        </div>
        <CardBody booking={booking} tCard={tCard} />
        {booking.reviewSubmitted && (
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-mist p-3">
            <div className="flex items-center gap-1 text-ink">
              <Stars filled={5} className="h-4 w-4" />
              <span className="text-sm font-bold text-ink">
                {tCard('reviewStars', { rating: booking.reviewSubmitted.rating })}
              </span>
            </div>
            <p className="text-sm italic text-ink-soft">"{booking.reviewSubmitted.body}"</p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-disabled="true"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-mist px-3 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface"
            >
              <ReceiptIcon className="h-4 w-4" />
              <span>{tCard('receiptUnavailable')}</span>
            </button>
            <button
              type="button"
              aria-disabled="true"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-mist px-3 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface"
            >
              <DownloadIcon className="h-4 w-4" />
              <span>{tCard('downloadNotes')}</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => onAction?.({ type: 'rebook', bookingId: booking.id })}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
          >
            <ReplayIcon className="h-4 w-4" />
            <span>{tCard('rebook')}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function ClosedCard({
  booking,
  tCard,
  tFilters,
}: {
  booking: LearnerBookingView;
  tCard: CardTranslator;
  tFilters: FiltersTranslator;
}) {
  const locale = useLocale() as 'vi' | 'en';
  const reason =
    booking.state === 'no_show_reported' ? tCard('noShowBody') : tCard('cancelledBody');
  const date = new Date(booking.startsAt).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return (
    <article className="rounded-2xl border border-border bg-mist p-6 text-sm text-ink-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Chip tone="neutral">
            <span>{tFilters('canceled')}</span>
          </Chip>
          <span className="text-sm text-ink-soft">{date}</span>
        </div>
      </div>
      <h3 className="mt-3 text-base font-semibold text-ink">{booking.classTitle}</h3>
      <p className="mt-1 text-sm text-ink-soft">{reason}</p>
    </article>
  );
}

/* --- Shared body row (icon + title + meta + price) --- */

function CardBody({
  booking,
  tCard,
  startText,
}: {
  booking: LearnerBookingView;
  tCard: CardTranslator;
  startText?: string;
}) {
  const ui = useTranslations('Workspace.copy');

  return (
    <div className="flex flex-col items-start gap-3 md:flex-row">
      <SkillBadge icon={booking.skillIcon} />
      <div className="flex flex-1 flex-col gap-1">
        <h3 className="text-base font-bold text-ink transition-colors hover:text-ink-soft">
          {booking.classTitle}
        </h3>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1 font-medium text-ink">
            <VerifiedIcon className="h-4 w-4 text-success-ink" />
            <span>
              {booking.teacherName} ({booking.teacherSchoolLabel})
            </span>
          </span>
          <span className="inline-flex items-center gap-1">
            <ScheduleIcon className="h-4 w-4 text-ink-soft" />
            <span>
              {startText ??
                tCard('startsAt', {
                  when: new Date(booking.startsAt).toLocaleString(),
                  duration: booking.durationMinutes,
                })}
            </span>
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-row items-end justify-between gap-1 text-right md:flex-col">
        <span className="text-sm text-ink-soft">
          {tCard('cost', { credits: booking.priceCredits })}
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-ink">{booking.priceCredits}</span>
          <span className="text-sm font-semibold text-slate-500">Credits</span>
        </div>
        <span className="text-sm text-slate-400 font-medium">
          ~{(booking.priceCredits * 1000).toLocaleString('vi-VN')}
          {ui('vnd')}
        </span>
      </div>
    </div>
  );
}

function RuleBox({ tCard }: { tCard: CardTranslator }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-mist p-4 text-sm text-ink-soft">
      <PolicyIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      <p className="leading-relaxed">
        <strong className="font-semibold text-ink">{tCard('ruleTitle')}: </strong>
        {tCard('ruleBody')}
      </p>
    </div>
  );
}

/* --- Small UI bits --- */

function Chip({
  tone,
  children,
}: {
  tone: 'ink' | 'success' | 'warning' | 'neutral';
  children: React.ReactNode;
}) {
  const map: Record<typeof tone, string> = {
    ink: 'border-ink/20 bg-mist text-ink',
    success: 'border-success-tint bg-success-tint text-success-ink',
    warning: 'border-warning-tint bg-warning-tint text-warning-ink',
    neutral: 'border-border bg-mist text-ink-soft',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold ${map[tone]}`}
    >
      {children}
    </span>
  );
}

function SkillBadge({ icon }: { icon: SkillIcon }) {
  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-border bg-mist text-ink">
      <SkillIconSvg icon={icon} />
    </span>
  );
}

function SkillIconSvg({ icon }: { icon: SkillIcon }) {
  const cn = 'h-7 w-7';
  switch (icon) {
    case 'language':
      return (
        <svg
          viewBox="0 0 24 24"
          width="32"
          height="32"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn}
        >
          <line x1="4" y1="5" x2="14" y2="5" />
          <path d="M4 5l-2 7" />
          <line x1="2" y1="12" x2="12" y2="12" />
          <path d="M14 21l4-10 4 10" />
          <line x1="15.5" y1="18" x2="21" y2="18" />
        </svg>
      );
    case 'code':
      return (
        <svg
          viewBox="0 0 24 24"
          width="32"
          height="32"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn}
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case 'design':
      return (
        <svg
          viewBox="0 0 24 24"
          width="32"
          height="32"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn}
        >
          <path d="M3 6h18l-2 12H5z" />
          <path d="M9 6V4a3 3 0 0 1 6 0v2" />
        </svg>
      );
    case 'math':
      return (
        <svg
          viewBox="0 0 24 24"
          width="32"
          height="32"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn}
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      );
    case 'business':
      return (
        <svg
          viewBox="0 0 24 24"
          width="32"
          height="32"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn}
        >
          <path d="M3 21V9l9-6 9 6v12" />
          <path d="M9 21v-8h6v8" />
        </svg>
      );
    case 'science':
      return (
        <svg
          viewBox="0 0 24 24"
          width="32"
          height="32"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn}
        >
          <path d="M9 3h6l-1 7 5 11H5l5-11z" />
        </svg>
      );
  }
}

function Stars({ filled, className = '' }: { filled: number; className?: string }) {
  return (
    <div className="flex text-warning-ink">
      {Array.from({ length: 5 }).map((_, idx) => (
        <svg
          key={idx}
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill={idx < filled ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1"
          strokeLinejoin="round"
          aria-hidden="true"
          className={className}
        >
          <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" />
        </svg>
      ))}
    </div>
  );
}

/* --- Inline SVG glyphs (small, one per cell) --- */

function PendingIcon({ className = '' }: { className?: string }) {
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
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function AlarmIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="13" r="8" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="9" y1="3" x2="15" y2="3" />
    </svg>
  );
}

function ReportIcon({ className = '' }: { className?: string }) {
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
      <path d="M12 3l10 18H2z" />
      <line x1="12" y1="10" x2="12" y2="14" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}

function CheckCircleIcon({ className = '' }: { className?: string }) {
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
      <circle cx="12" cy="12" r="9" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function EventAvailableIcon({ className = '' }: { className?: string }) {
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
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <polyline points="9 16 11 18 15 14" />
    </svg>
  );
}

function LockIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
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
    </svg>
  );
}

function LinkIcon({ className = '' }: { className?: string }) {
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
      <path d="M10 14l4-4" />
      <path d="M13 8a4 4 0 0 1 5 5l-1 1" />
      <path d="M11 16a4 4 0 0 1-5-5l1-1" />
    </svg>
  );
}

function PolicyIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z" />
    </svg>
  );
}

function ChatIcon({ className = '' }: { className?: string }) {
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
      <path d="M21 12a8 8 0 0 1-12.6 6.6L3 21l1.4-4.7A8 8 0 1 1 21 12z" />
    </svg>
  );
}

function DownloadIcon({ className = '' }: { className?: string }) {
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
      <path d="M12 4v12" />
      <polyline points="7 11 12 16 17 11" />
      <line x1="4" y1="20" x2="20" y2="20" />
    </svg>
  );
}

function LockClockIcon({ className = '' }: { className?: string }) {
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
      <circle cx="12" cy="16" r="2" />
    </svg>
  );
}

function TaskAltIcon({ className = '' }: { className?: string }) {
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
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function ReceiptIcon({ className = '' }: { className?: string }) {
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
      <path d="M5 3h14v18l-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

function ReplayIcon({ className = '' }: { className?: string }) {
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
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10" />
    </svg>
  );
}

function VerifiedIcon({ className = '' }: { className?: string }) {
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
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function ScheduleIcon({ className = '' }: { className?: string }) {
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
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function LiveCard({ booking, tCard }: { booking: LearnerBookingView; tCard: CardTranslator }) {
  const ui = useTranslations('Workspace.copy');

  const tLive = useTranslations('Dashboard.live');
  const locale = useLocale() as 'vi' | 'en';
  const start = new Date(booking.startsAt).getTime();
  const now = Date.now();
  const elapsedMs = Math.max(0, now - start);
  const totalMs = booking.durationMinutes * 60 * 1000;
  const elapsedMin = Math.min(booking.durationMinutes, Math.floor(elapsedMs / (60 * 1000)));
  const pct = Math.min(100, Math.round((elapsedMs / totalMs) * 100));
  const startTimeText = new Date(booking.startsAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTimeText = new Date(start + totalMs).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <article className="relative overflow-hidden rounded-2xl border-2 border-emerald-500 bg-surface p-6 shadow-md transition-shadow">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-campus-emerald-deep" />
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-campus-emerald-deep" />
            </span>
            <Chip tone="success">
              <VideocamIcon className="h-4 w-4" />
              <span className="font-bold tracking-wide">{tLive('badge')}</span>
            </Chip>
            <span className="text-sm text-ink-soft">
              {tCard('bookingId', { id: booking.id.split('-').slice(-1)[0] ?? booking.id })}
            </span>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-800 border border-emerald-200">
            <LockIcon className="h-3.5 w-3.5 text-emerald-600" />
            <span>{tCard('escrowHeld', { credits: booking.priceCredits })}</span>
          </span>
        </div>

        <div>
          <h3 className="text-xl font-bold text-ink tracking-tight mb-2">{booking.classTitle}</h3>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                {booking.teacherInitial}
              </span>
              <span>{booking.teacherName}</span>
              <span className="text-ink-muted">· {booking.teacherSchoolLabel}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-ink-soft">
              <ScheduleIcon className="h-3.5 w-3.5 text-ink-muted" />
              <span>
                {startTimeText} - {endTimeText} ({booking.durationMinutes} {ui('min')}
              </span>
            </span>
          </div>
        </div>

        <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">
              {tLive('progress')}:{' '}
              <strong className="text-emerald-700">
                {elapsedMin}/{booking.durationMinutes} {ui('mine5d92')}
              </strong>
            </span>
            <span className="font-bold text-emerald-700">{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-campus-emerald-deep transition-colors duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-ink-soft">{tCard('roomUnavailable')}</span>

          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}/bookings/${booking.id}/live`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-campus-emerald-deep px-6 py-2.5 text-sm font-semibold text-white  transition-colors hover:bg-ink sm:w-auto"
            >
              <VideocamIcon className="h-4 w-4" />
              <span>{tLive('join')}</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function VideocamIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

// Sanity: BookingState is consumed by switch so it must be referenced.
void (null as unknown as BookingState);
