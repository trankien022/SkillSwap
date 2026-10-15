import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { LearnerBookingView } from '../../lib/dashboard/types';

/**
 * Live session banner (FR-021 / FR-022).
 *
 * Renders the in_progress booking at the top of the session list
 * with a pulse indicator, class title, teacher + time + escrow
 * chip, "Join the room" CTA, and a real-time progress bar
 * (elapsed vs total duration). The progress is computed from the
 * booking's startsAt + durationMinutes; the banner is hidden when
 * no booking is in_progress.
 */
export async function LiveSessionBanner({
  booking,
}: {
  booking: LearnerBookingView | null;
}) {
  const t = await getTranslations('Dashboard.live');
  const tCard = await getTranslations('Dashboard.card');
  const locale = (await getLocale()) as 'vi' | 'en';

  if (!booking) return null;

  const start = new Date(booking.startsAt).getTime();
  const now = Date.now();
  const elapsedMs = Math.max(0, now - start);
  const totalMs = booking.durationMinutes * 60 * 1000;
  const elapsedMin = Math.min(
    booking.durationMinutes,
    Math.floor(elapsedMs / (60 * 1000)),
  );
  const pct = Math.min(
    100,
    Math.round((elapsedMs / totalMs) * 100),
  );
  const dateText = new Date(booking.startsAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-md md:p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-mist blur-3xl"
      />
      <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center">
          <div className="relative shrink-0">
            <div className="flex h-20 w-20 flex-col items-center justify-center rounded-2xl bg-ink text-surface shadow-lg">
              <VideocamIcon className="h-7 w-7 animate-pulse" />
              <span className="mt-0.5 text-[11px] font-bold tracking-wider text-surface">
                {t('badge')}
              </span>
            </div>
            <span className="absolute -right-1 -top-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-ink opacity-75" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-danger-ink" />
            </span>
          </div>
          <div className="flex max-w-2xl flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-danger-ink bg-danger-ink px-2.5 py-0.5 text-xs font-bold text-surface">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-surface" />
                <span>{t('badge')}</span>
              </span>
            </div>
            <h2 className="text-xl font-bold leading-tight tracking-tight text-ink sm:text-2xl">
              {booking.classTitle}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
              <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                <PersonIcon className="h-4 w-4 text-ink" />
                <span>
                  {booking.teacherName}
                  {' · '}
                  {booking.teacherSchoolLabel}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ScheduleIcon className="h-4 w-4 text-ink" />
                <span>
                  {dateText} -{' '}
                  {new Date(
                    start + booking.durationMinutes * 60 * 1000,
                  ).toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  ({t('elapsed', {
                    elapsed: elapsedMin,
                    total: booking.durationMinutes,
                  })})
                </span>
              </span>
              <span className="rounded bg-mist px-2 py-0.5 text-xs font-semibold text-ink">
                {tCard('escrowHeld', { credits: booking.priceCredits })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center xl:flex-col xl:items-end">
          <Link
            href={`/${locale}/bookings/${booking.id}/live`}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-bold text-surface shadow-md transition-colors hover:bg-ink-soft"
          >
            <MeetingRoomIcon className="h-5 w-5" />
            <span>{t('join')}</span>
            <span aria-hidden="true">→</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-disabled="true"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-mist px-3 py-2 text-xs font-semibold text-ink-soft transition-colors hover:bg-surface sm:flex-initial"
            >
              <FolderIcon className="h-4 w-4" />
              <span>{t('materials')}</span>
            </button>
            <button
              type="button"
              aria-disabled="true"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-mist px-3 py-2 text-xs font-semibold text-ink-soft transition-colors hover:bg-surface sm:flex-initial"
            >
              <ChatIcon className="h-4 w-4" />
              <span>{t('chat')}</span>
            </button>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-1.5 border-t border-border pt-3">
        <div className="flex items-center justify-between text-xs text-ink-soft">
          <span>{t('progress')}</span>
          <span className="font-semibold text-ink">
            {t('pct', { pct })} ({t('elapsed', {
              elapsed: elapsedMin,
              total: booking.durationMinutes,
            })})
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-mist">
          <div
            className="h-full rounded-full bg-ink"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </section>
  );
}

/* --- Inline SVG glyphs --- */

function VideocamIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}

function PersonIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
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

function MeetingRoomIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 21h18" />
      <path d="M5 21V5a2 2 0 0 1 2-2h6v18" />
      <path d="M13 12h6" />
      <path d="M16 9l3 3-3 3" />
    </svg>
  );
}

function FolderIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function ChatIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M21 12a8 8 0 0 1-12.6 6.6L3 21l1.4-4.7A8 8 0 1 1 21 12z" />
    </svg>
  );
}