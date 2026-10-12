'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { ClassDetailView } from '../../lib/marketplace/types';
import { mapCreatedClassToDetail } from '../../lib/marketplace/api-class-detail';
import { formatSeats, hoursUntilBookingDeadline } from '../../lib/marketplace/mock-data';

/**
 * Client-side hydration fallback for classes created in the current browser session
 * (stored in localStorage.getItem('skillswap_created_classes')).
 *
 * If the class exists in browser storage, renders the complete class detail view
 * and sticky booking card. If not found, renders the localized 404 panel.
 */
export function ClientClassDetailFallback({ id }: { id: string }) {
  const [mounted, setMounted] = useState(false);
  const [item, setItem] = useState<ClassDetailView | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem('skillswap_created_classes');
      if (raw) {
        const stored = JSON.parse(raw);
        if (Array.isArray(stored)) {
          const found = stored.find((c: { id: string }) => c.id === id);
          if (found) {
            setItem(mapCreatedClassToDetail(found));
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Failed to resolve local class from storage:', err);
    }
    setItem(null);
  }, [id]);

  if (!mounted) {
    return <LoadingSkeleton />;
  }

  if (!item) {
    return <ClientNotFoundPanel />;
  }

  return <ClientClassDetailBody item={item} />;
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse" aria-busy="true">
      <div className="h-48 w-full rounded-xl bg-surface border border-border" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-8">
          <div className="h-40 rounded-xl bg-surface border border-border" />
          <div className="h-56 rounded-xl bg-surface border border-border" />
          <div className="h-32 rounded-xl bg-surface border border-border" />
        </div>
        <div className="lg:col-span-4">
          <div className="h-72 rounded-xl bg-surface border border-border" />
        </div>
      </div>
    </div>
  );
}

function ClientNotFoundPanel() {
  const t = useTranslations('ClassDetail.notFound');
  const locale = useLocale();

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mist text-ink">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
          <line x1="8" y1="8" x2="14" y2="14" />
        </svg>
      </span>
      <h1 className="text-xl font-bold text-ink">{t('title')}</h1>
      <p className="text-sm text-ink-soft">{t('body')}</p>
      <a
        href={`/${locale}/classes`}
        className="mt-2 inline-flex items-center gap-1 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-ink-soft"
      >
        {t('back')}
      </a>
    </div>
  );
}

function ClientClassDetailBody({ item }: { item: ClassDetailView }) {
  const locale = useLocale() as 'vi' | 'en';
  const tHero = useTranslations('ClassDetail.hero');
  const tBread = useTranslations('ClassDetail.breadcrumb');
  const tDetail = useTranslations('ClassDetail');
  const tSchedule = useTranslations('ClassDetail.schedule');
  const tSyllabus = useTranslations('ClassDetail.syllabus');
  const tPrereq = useTranslations('ClassDetail.prerequisites');
  const tDossier = useTranslations('ClassDetail.dossier');
  const tReviews = useTranslations('ClassDetail.reviews');
  const tEscrow = useTranslations('ClassDetail.escrow');
  const tBooking = useTranslations('ClassDetail.booking');

  const hoursLeft = hoursUntilBookingDeadline(item.startsAt);
  const [taken, capacity] = formatSeats(item.format, item.capacity).split('/').map(Number);
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
  const vnd = (item.priceCredits * 1000).toLocaleString(locale);

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb band */}
      <div className="w-full border-b border-border bg-surface rounded-xl p-4 shadow-sm">
        <div className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-center">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-ink-soft">
            <a href={`/${locale}`} className="flex items-center gap-1 transition-colors hover:text-ink">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 9l9-6 9 6v10a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2V9z" />
              </svg>
              <span>{tBread('home')}</span>
            </a>
            <span aria-hidden="true" className="text-ink-muted">/</span>
            <a href={`/${locale}/classes`} className="transition-colors hover:text-ink">
              {tBread('explore')}
            </a>
            <span aria-hidden="true" className="text-ink-muted">/</span>
            <span className="max-w-xs truncate font-semibold text-ink md:max-w-sm">
              {item.skillName}
            </span>
          </nav>
          <a
            href={`/${locale}/classes`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>{tDetail('backToList')}</span>
          </a>
        </div>
      </div>

      {/* Hero card */}
      <section className="relative overflow-hidden rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-campus-emerald-tint blur-2xl"
        />
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg border border-border bg-mist px-2 py-0.5 text-xs font-semibold text-ink-soft">
              <span>{item.format === 'one-on-one' ? tHero('format.oneOnOne') : tHero('format.group')}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-ink/20 bg-ink/10 px-2 py-0.5 text-xs font-semibold text-ink">
              <span>{tHero('levelBadge')}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-success-tint bg-success-tint px-2 py-0.5 text-xs font-semibold text-success-ink">
              <span>{tHero('security')}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-warning-tint bg-warning-tint px-2 py-0.5 text-xs font-semibold text-warning-ink">
              <span>{tHero('mockBadge')}</span>
            </span>
          </div>

          <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
            {item.skillName}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
            <div className="flex items-center gap-1 text-ink">
              <span className="text-warning-ink font-bold">★ {item.ratingAvg.toFixed(2)}</span>
              <span className="font-normal text-ink-soft">
                ({tHero('reviewsCount', { count: item.ratingCount })})
              </span>
            </div>
            <span aria-hidden="true" className="text-ink-muted">•</span>
            <div className="flex items-center gap-1">
              <span className="text-campus-emerald font-semibold">✓</span>
              <span>{tHero('completedLabel', { count: item.teacherStats.hoursTaught })}</span>
            </div>
          </div>

          {/* Teacher lead-in */}
          <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-border bg-mist p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div
                className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-semibold text-surface"
                aria-hidden="true"
              >
                {item.teacherName.charAt(0).toUpperCase()}
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface shadow-sm">
                  <span className="text-[12px] text-success-ink">✓</span>
                </span>
              </div>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-ink">{item.teacherName}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-success-tint bg-success-tint px-2 py-0.5 text-[11px] font-semibold text-success-ink">
                    <span>{item.schoolName}</span>
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-soft">{item.teacherBio}</p>
              </div>
            </div>
            <a
              href="#instructor-dossier"
              className="flex shrink-0 items-center gap-1 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
            >
              <span>{tHero('profileLink')}</span>
              <span>→</span>
            </a>
          </div>
        </div>
      </section>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column (8/12) */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          {/* Schedule section */}
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">{tSchedule('title')}</h2>
              <span className="rounded-lg border border-campus-emerald/20 bg-campus-emerald-tint px-2 py-1 text-[11px] font-semibold text-campus-emerald-deep">
                {tSchedule('policyBadge')}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <article className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-mist p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                  {tSchedule('kickoff')}
                </div>
                <div className="flex flex-col">
                  <span className="text-base font-semibold text-ink">{dateText}</span>
                  <span className="text-sm font-semibold text-ink">
                    {timeText} • {item.durationMinutes} phút
                  </span>
                </div>
                <div className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-surface px-2 py-1 text-[11px] font-semibold text-success-ink shadow-sm">
                  <span>⏱ {tSchedule('deadlinePrefix', { hours: Math.max(1, hoursLeft) })}</span>
                </div>
              </article>

              <article className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-mist p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                  {tSchedule('capacity')}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-semibold text-ink">
                      {item.format === 'one-on-one' ? tSchedule('oneOnOne') : tSchedule('group')}
                    </span>
                    <span className={isFull ? 'rounded-full bg-error-tint px-2 py-0.5 text-[11px] font-bold text-error-ink' : 'rounded-full border border-success-tint bg-success-tint px-2 py-0.5 text-[11px] font-bold text-success-ink'}>
                      {tSchedule('seatsLeft', { taken, capacity })}
                    </span>
                  </div>
                  <span className="text-sm text-ink-soft">
                    {item.format === 'one-on-one' ? tSchedule('oneOnOneLimit') : tSchedule('groupLimit')}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-ink-soft">
                  <span className="text-campus-emerald">📹</span>
                  <span>{tSchedule('room')}</span>
                </div>
              </article>
            </div>
          </section>

          {/* Syllabus section */}
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">{tSyllabus('title')}</h2>
              <span className="text-xs text-ink-soft">{tSyllabus('target')}</span>
            </div>
            <p className="mb-6 text-sm leading-relaxed text-ink-soft">{item.description}</p>
            <ol className="flex flex-col gap-4">
              {item.syllabus.map((step) => (
                <li key={step.order} className="flex items-start gap-3 rounded-xl border border-border bg-mist p-4 transition-colors hover:bg-neutral-tint">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-surface">
                    {String(step.order).padStart(2, '0')}
                  </span>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold text-ink">{tSyllabus('stepN', { n: step.order })}: {step.title}</span>
                      <span className="text-xs text-ink-soft">{tSyllabus('minutes', { n: step.minutes })}</span>
                    </div>
                    <p className="text-sm text-ink-soft">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Prerequisites */}
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-ink">{tPrereq('title')}</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {item.prerequisites.map((req, idx) => (
                <article key={idx} className="flex flex-col gap-2 rounded-xl border border-border bg-mist p-4">
                  <span className="text-base font-semibold text-ink">{req.title}</span>
                  <p className="text-sm text-ink-soft">{req.body}</p>
                </article>
              ))}
            </div>
          </section>

          {/* Teacher dossier */}
          <section id="instructor-dossier" className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">{tDossier('title')}</h2>
              <span className="text-sm font-semibold text-success-ink">{tDossier('locked')}</span>
            </div>
            <div className="mb-6 flex flex-col items-start gap-4 md:flex-row">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-ink text-2xl font-bold text-surface shadow-sm">
                {item.teacherName.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <h3 className="text-base font-semibold text-ink">{item.teacherName}</h3>
                <p className="text-sm text-ink-soft">{item.schoolName}</p>
                <p className="mt-1 text-sm text-ink-soft">{item.teacherBio}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                {tDossier('credentialsHeading')}
              </span>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {item.teacherCredentials.map((cred, idx) => (
                  <article key={idx} className="flex items-start gap-3 rounded-xl border border-border bg-mist p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-ink shadow-sm font-bold">★</span>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span className="text-sm font-semibold text-ink">{cred.title}</span>
                      <span className="text-sm text-ink-soft">{cred.body}</span>
                      {cred.verifiedBy && (
                        <span className="mt-1 text-[11px] font-semibold text-success-ink">
                          ✓ {tDossier('verifiedBy')} • {cred.verifiedBy}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* Reviews */}
          <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">{tReviews('title')}</h2>
              <span className="text-sm font-semibold text-ink-soft">{tReviews('all', { count: item.reviews.length })}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {item.reviews.map((rev) => (
                <article key={rev.id} className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-mist p-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink">{rev.authorName}</span>
                      <span className="text-xs text-warning-ink">{'★'.repeat(rev.rating)}</span>
                    </div>
                    <p className="text-sm italic text-ink-soft">"{rev.body}"</p>
                  </div>
                  <span className="text-[11px] text-ink-soft">{tReviews('autoVerified')}</span>
                </article>
              ))}
            </div>
          </section>

          {/* Escrow banner */}
          <aside className="flex items-start gap-3 rounded-xl border border-success-tint bg-success-tint/50 p-4 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-success-ink shadow-sm text-xl">
              🛡
            </span>
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-bold text-success-ink-deep">{tEscrow('title')}</h3>
              <p className="text-sm leading-relaxed text-ink-soft">{tEscrow('body')}</p>
            </div>
          </aside>
        </div>

        {/* Right column: Sticky Booking Card (4/12) */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-surface p-6 shadow-md">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                    {tBooking('priceLabel')}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-ink">{item.priceCredits} Credits</span>
                    <span className="text-sm text-ink-soft">{tBooking('perSession')}</span>
                  </div>
                  <span className="text-[11px] text-ink-soft">{tBooking('vndRate', { vnd })}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-full bg-error-tint px-2 py-1 text-[11px] font-bold text-error-ink">
                    100% Hoàn trả
                  </span>
                  <span className="text-right text-[11px] text-ink-soft">{`${taken}/${capacity}`}</span>
                </div>
              </div>

              {/* Quick recap table */}
              <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-mist p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">{tBooking('table.duration')}</span>
                  <span className="font-semibold text-ink">{tBooking('table.durationValue', { n: item.durationMinutes })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">{tBooking('table.startTime')}</span>
                  <span className="font-semibold text-ink">{timeText}, {dateText}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">{tBooking('table.refund')}</span>
                  <span className="font-semibold text-success-ink">{tBooking('table.refundValue')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">{tBooking('table.format')}</span>
                  <span className="font-semibold text-ink">{tBooking('table.formatValue')}</span>
                </div>
              </div>

              {/* Direct Escrow Checkout CTA */}
              <div className="mt-2">
                <a
                  href={`/${locale}/classes/${item.id}/checkout`}
                  className="flex w-full items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  <span>
                    {locale === 'vi'
                      ? `Xem xét & Khóa ký quỹ (${item.priceCredits} Credit)`
                      : `Review & Lock Escrow (${item.priceCredits} Credits)`}
                  </span>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </a>
              </div>

              {/* Trust signals */}
              <div className="mt-4 flex flex-col gap-1 text-[11px] text-ink-soft">
                <div className="flex items-center gap-1.5">
                  <span>🔒</span>
                  <span>Credits chỉ chuyển cho giảng viên sau khi kết thúc buổi học</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>🛡</span>
                  <span>Hỗ trợ tranh chấp học thuật trong 24 giờ sau giờ học</span>
                </div>
              </div>
            </div>

            {/* Support card */}
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-mist text-ink font-bold">
                ?
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-ink">{tBooking('supportTitle')}</span>
                <span className="text-[11px] text-ink-soft">{tBooking('supportSubtitle')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
