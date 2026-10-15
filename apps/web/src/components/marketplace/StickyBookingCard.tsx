'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CompositeBookingAction } from '../booking/composite-booking-action';
import { formatSeats, formatStartsAt } from '../../lib/marketplace/mock-data';
import type { ClassDetailView } from '../../lib/marketplace/types';

/**
 * Sticky booking card for the class detail page (FR-006 detail).
 *
 * Renders a price recap table faithful to the SRS (no '100% refund' / no
 * 'Smart-Escrow'), **one** committing action — `CompositeBookingAction`, which
 * books, gates against the balance and confirms in a single press (D5) — and
 * the trust signals below it.
 *
 * This card used to render a `BookingPanel` ("Đặt lớp") *and* a second
 * "review & lock" link on top of it: two buttons, one API, so the first press
 * created the hold and the second was refused as a duplicate. Both are gone;
 * the wallet balance is likewise never shown here from a made-up figure.
 */
export function StickyBookingCard({
  item,
}: {
  item: ClassDetailView;
}) {
  const t = useTranslations('ClassDetail.booking');
  const locale = useLocale() as 'vi' | 'en';
  const dateText = formatStartsAt(item.startsAt, locale);
  const timeText = new Date(item.startsAt).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const vnd = (item.priceCredits * 1000).toLocaleString(locale);
  const [taken, capacity] = formatSeats(item.format, item.capacity)
    .split('/')
    .map((n) => Number(n));

  return (
    <div className="sticky top-24 flex flex-col gap-4">
      {/* Main booking card */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-md">
        {/* Price + scarcity header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              {t('priceLabel')}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-ink">
                {item.priceCredits} Credits
              </span>
              <span className="text-sm text-ink-soft">
                {t('perSession')}
              </span>
            </div>
            <span className="text-[11px] text-ink-soft">
              {t('vndRate', { vnd })}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-full bg-danger-tint px-2 py-1 text-[11px] font-bold text-danger-ink">
              {t('table.refundValue').split(' ').slice(-2).join(' ')}
            </span>
            <span className="text-right text-[11px] text-ink-soft">
              {`${taken}/${capacity}`}
            </span>
          </div>
        </div>

        {/* Quick recap table */}
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-mist p-4 text-sm">
          <Row
            icon={<HourglassIcon className="h-4 w-4 text-ink-soft" />}
            label={t('table.duration')}
            value={t('table.durationValue', { n: item.durationMinutes })}
          />
          <Row
            icon={<EventIcon className="h-4 w-4 text-ink-soft" />}
            label={t('table.startTime')}
            value={`${timeText}, ${dateText}`}
          />
          <Row
            icon={<VerifiedIcon className="h-4 w-4 text-ink-soft" />}
            label={t('table.refund')}
            value={
              <span className="font-semibold text-success-ink">
                {t('table.refundValue')}
              </span>
            }
          />
          <Row
            icon={<EncryptedIcon className="h-4 w-4 text-ink-soft" />}
            label={t('table.format')}
            value={t('table.formatValue')}
          />
        </div>

        {/* The single committing action: book → balance gate → confirm.
            Checkout is no longer a second entry point — it is where the gate
            sends a learner who cannot afford the class yet. */}
        <CompositeBookingAction item={item} />

        {/* Trust signals */}
        <div className="mt-4 flex flex-col gap-1 text-[11px] text-ink-soft">
          <div className="flex items-center gap-1.5">
            <LockClockIcon className="h-3.5 w-3.5" />
            <span>
              {t('table.refund').includes('Chính sách')
                ? 'Credits chỉ chuyển cho giảng viên sau khi kết thúc buổi học'
                : 'Credits only released to the teacher after the session ends'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <SupportAgentIcon className="h-3.5 w-3.5" />
            <span>
              {t('table.refund').includes('Chính sách')
                ? 'Hỗ trợ tranh chấp học thuật trong 24 giờ sau giờ học'
                : 'Academic dispute support for 24 hours after the session'}
            </span>
          </div>
        </div>
      </div>

      {/* Support card */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mist text-ink">
          <ContactSupportIcon className="h-5 w-5" />
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-ink">
            {t('supportTitle')}
          </span>
          <span className="text-[11px] text-ink-soft">
            {t('supportSubtitle')}
          </span>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-1.5 text-ink-soft">
        {icon}
        <span>{label}</span>
      </span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

/* --- Inline SVG glyphs --- */

function HourglassIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M6 2h12M6 22h12" />
      <path d="M6 2c0 5 6 5 6 10s-6 5-6 10" />
      <path d="M18 2c0 5-6 5-6 10s6 5 6 10" />
    </svg>
  );
}

function EventIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}

function VerifiedIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function EncryptedIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function LockClockIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
      <rect x="6" y="11" width="4" height="3" />
    </svg>
  );
}

function SupportAgentIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l1.4-4.7A8.5 8.5 0 1 1 21 11.5z" />
    </svg>
  );
}

function ContactSupportIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12" y2="17.01" />
    </svg>
  );
}