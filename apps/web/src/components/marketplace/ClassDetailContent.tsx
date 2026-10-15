'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { HttpMarketplaceGateway } from '../../lib/marketplace/http-gateway';
import { ClassDetailApiGateway } from '../../lib/marketplace/api-class-detail';
import { toClassDetailView } from '../../lib/marketplace/api-mapping';
import { DetailHeader } from './DetailHeader';
import { ScheduleSection } from './ScheduleSection';
import { SyllabusSection } from './SyllabusSection';
import { PrerequisitesSection } from './PrerequisitesSection';
import { TeacherDossierSection } from './TeacherDossierSection';
import { ReviewsSection } from './ReviewsSection';
import { EscrowInlineBanner } from './EscrowInlineBanner';
import { StickyBookingCard } from './StickyBookingCard';
import type { ClassDetailView } from '../../lib/marketplace/types';

const gateway = new HttpMarketplaceGateway();
const verdictGateway = new ClassDetailApiGateway();

type LoadState =
  | { phase: 'loading' }
  | { phase: 'unauth' }
  | { phase: 'error' }
  | { phase: 'not_found' }
  | { phase: 'ready'; item: ClassDetailView };

/**
 * Class detail composition (FR-006 detail).
 *
 * `GET /classes` is an authenticated endpoint, so the class is fetched
 * after mount (the bearer token lives in localStorage). The fetch drives
 * four honest states: loading skeleton, sign-in prompt when the session
 * is missing/expired, a retryable error, and the composed body once real
 * data arrives. The detail-only sections are derived from the real class
 * by `toClassDetailView` — never mocked.
 *
 * Booking is read separately from `GET /classes/:id`, the only route that
 * answers *for this caller*: `canBook`, an existing hold (`ownBooking`) and
 * the free-seat count. Merging them is what lets the booking action refuse a
 * second seat, reuse a hold, and name why a class cannot be booked — with the
 * server's words rather than a guess.
 */
export function ClassDetailContent({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ phase: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ phase: 'loading' });
    Promise.all([
      gateway.findById(id),
      // A failed verdict read must not hide a class the catalogue already
      // resolved: it resolves to null and the view keeps its honest defaults
      // (not bookable, no known hold). The server is the only thing allowed to
      // say yes, so "unknown" stays closed rather than optimistically open.
      verdictGateway.getById(id).catch(() => null),
    ])
      .then(([item, verdict]) => {
        if (!active) return;
        if (item === null) {
          setState({ phase: 'not_found' });
          return;
        }
        const view = toClassDetailView(item);
        setState({
          phase: 'ready',
          item:
            verdict === null
              ? view
              : {
                  ...view,
                  canBook: verdict.canBook,
                  ownBooking: verdict.ownBooking,
                  availableSeats: verdict.availableSeats,
                },
        });
      })
      .catch((error) => {
        if (!active) return;
        const status = (error as { status?: number }).status;
        setState({ phase: status === 401 ? 'unauth' : 'error' });
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (state.phase === 'loading') return <LoadingPanel />;
  if (state.phase === 'unauth') return <UnauthPanel />;
  if (state.phase === 'error') return <ErrorPanel />;
  if (state.phase === 'not_found') return <NotFoundPanel />;
  return <ClassDetailBody item={state.item} />;
}

function ClassDetailBody({ item }: { item: ClassDetailView }) {
  return (
    <div className="flex flex-col gap-6">
      <DetailHeader item={item} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column (8/12) — content sections */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          <ScheduleSection item={item} />
          <SyllabusSection item={item} />
          <PrerequisitesSection item={item} />
          <TeacherDossierSection item={item} />
          <ReviewsSection item={item} />
          <EscrowInlineBanner />
        </div>
        {/* Right column (4/12) — sticky booking */}
        <div className="lg:col-span-4">
          <StickyBookingCard item={item} />
        </div>
      </div>
    </div>
  );
}

/** Skeleton mirroring the hero + content column so nothing jumps on load. */
function LoadingPanel() {
  const t = useTranslations('ClassDetail.states');
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">{t('loading')}</span>
      <div aria-hidden="true" className="h-48 animate-pulse rounded-xl border border-border bg-surface shadow-sm" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div aria-hidden="true" className="flex flex-col gap-6 lg:col-span-8">
          <div className="h-40 animate-pulse rounded-xl border border-border bg-surface shadow-sm" />
          <div className="h-56 animate-pulse rounded-xl border border-border bg-surface shadow-sm" />
        </div>
        <div aria-hidden="true" className="lg:col-span-4">
          <div className="h-72 animate-pulse rounded-xl border border-border bg-surface shadow-sm" />
        </div>
      </div>
    </div>
  );
}

function UnauthPanel() {
  const t = useTranslations('ClassDetail.states');
  const locale = useLocale();
  return (
    <Panel
      tone="info"
      icon={<LockIcon className="h-6 w-6" />}
      title={t('signInTitle')}
      body={t('signInBody')}
      cta={{ href: `/${locale}/auth?tab=login`, label: t('signInCta') }}
    />
  );
}

function ErrorPanel() {
  const t = useTranslations('ClassDetail.states');
  const locale = useLocale();
  return (
    <Panel
      tone="error"
      icon={<AlertIcon className="h-6 w-6" />}
      title={t('errorTitle')}
      body={t('errorBody')}
      cta={{ href: `/${locale}/classes`, label: t('back') }}
    />
  );
}

function Panel({
  tone,
  icon,
  title,
  body,
  cta,
}: {
  tone: 'info' | 'error';
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  const iconTone =
    tone === 'error'
      ? 'bg-danger-tint text-danger-ink'
      : 'bg-success-tint text-campus-emerald-deep';
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border border-border bg-surface p-12 text-center shadow-sm"
    >
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${iconTone}`}>
        {icon}
      </span>
      <h1 className="text-xl font-bold text-ink">{title}</h1>
      <p className="text-sm text-ink-soft">{body}</p>
      <Link
        href={cta.href}
        className="mt-2 inline-flex items-center gap-1 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-ink-soft"
      >
        {cta.label}
      </Link>
    </div>
  );
}

function NotFoundPanel() {
  const t = useTranslations('ClassDetail.notFound');
  const locale = useLocale();
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mist text-ink">
        <SearchOffIcon className="h-7 w-7" />
      </span>
      <h1 className="text-xl font-bold text-ink">{t('title')}</h1>
      <p className="text-sm text-ink-soft">{t('body')}</p>
      <Link
        href={`/${locale}/classes`}
        className="mt-2 inline-flex items-center gap-1 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-ink-soft"
      >
        {t('back')}
      </Link>
    </div>
  );
}

/* --- Inline SVG glyphs --- */

function SearchOffIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
      <line x1="8" y1="8" x2="14" y2="14" />
    </svg>
  );
}

function LockIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function AlertIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="16" x2="12" y2="16.01" />
    </svg>
  );
}
