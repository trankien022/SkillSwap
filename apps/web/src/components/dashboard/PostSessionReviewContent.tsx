'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createRatingSchema,
  myBookingsPageSchema,
  ratingViewSchema,
  walletBalanceSchema,
  type LearnerBookingItemView,
} from '@skillswap/contracts';
import { callApi, getTokens, unwrapEnvelope } from '../../lib/api-client';
import {
  computeNetCredits,
  computePlatformFee,
  computeVndEstimate,
} from '../../lib/teacher/money';

export interface PostSessionReviewProps {
  bookingId: string;
}

/**
 * Post-session settlement and peer review page (FR-013 review, FR-038 escrow
 * release).
 *
 * Every displayed value comes from the API, and the review is only reported as
 * submitted once the backend confirms it:
 *
 * - the booking is read from `GET /classes/bookings/me` and located by the
 *   route's booking id, which is what authorises the screen (owner-bound
 *   server-side, so another learner's booking simply will not be found);
 * - the wallet line comes from `GET /wallet/balance`;
 * - the settlement split is derived from the booking price with the shared
 *   `computePlatformFee`/`computeNetCredits` rules, so it cannot disagree with
 *   the publish preview;
 * - submit posts `POST /classes/bookings/:bookingId/rating` and branches on the
 *   response. A previous version ignored the result and always showed success.
 *
 * `GET`, `POST` and the rating contract all already existed; no endpoint was
 * added for this screen.
 */

const SKILL_ICON_BY_CATEGORY: Record<string, string> = {
  language: 'translate',
  programming: 'code',
  music: 'music_note',
  math: 'calculate',
  design: 'palette',
};

type LoadState =
  | { phase: 'loading' }
  | { phase: 'ready'; booking: LearnerBookingItemView; availableCredits: number | null }
  | { phase: 'signed-out' }
  | { phase: 'not-found' }
  | { phase: 'not-eligible' }
  | { phase: 'already-rated' }
  | { phase: 'error'; message: string };

type SubmitState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'success' }
  | { phase: 'error'; message: string };

export function PostSessionReviewContent({ bookingId }: PostSessionReviewProps) {
  const t = useTranslations('PostSessionReview');
  const locale = useLocale();
  const router = useRouter();

  const [load, setLoad] = useState<LoadState>({ phase: 'loading' });
  const [submit, setSubmit] = useState<SubmitState>({ phase: 'idle' });

  const [overallRating, setOverallRating] = useState<number>(5);
  const [criteriaRatings, setCriteriaRatings] = useState<{ [key: number]: number }>({
    1: 5,
    2: 5,
    3: 5,
    4: 5,
  });
  const [comment, setComment] = useState<string>('');

  const skillIcon = useCallback((item: LearnerBookingItemView): string => {
    // The booking summary carries skill ids, not categories; the profile-skills
    // catalogue is the only place that maps one to the other, so fall back to a
    // neutral glyph rather than guessing.
    return SKILL_ICON_BY_CATEGORY[item.classSummary.skillIds[0] ?? ''] ?? 'school';
  }, []);

  useEffect(() => {
    let active = true;

    async function loadBooking() {
      if (getTokens() === null) {
        setLoad({ phase: 'signed-out' });
        return;
      }

      try {
        const [bookingsRes, balanceRes] = await Promise.all([
          callApi('/classes/bookings/me?limit=50'),
          callApi('/wallet/balance'),
        ]);

        if (bookingsRes.status === 401) {
          if (active) setLoad({ phase: 'signed-out' });
          return;
        }
        if (!bookingsRes.ok) {
          if (active) {
            setLoad({ phase: 'error', message: t('form.errorTitle') });
          }
          return;
        }

        const page = myBookingsPageSchema.parse(await unwrapEnvelope<unknown>(bookingsRes));
        const booking = page.items.find((item) => item.bookingId === bookingId);
        if (booking === undefined) {
          if (active) setLoad({ phase: 'not-found' });
          return;
        }

        if (booking.hasRated) {
          if (active) setLoad({ phase: 'already-rated' });
          return;
        }
        if (!booking.ratingEligible) {
          if (active) setLoad({ phase: 'not-eligible' });
          return;
        }

        let availableCredits: number | null = null;
        if (balanceRes.ok) {
          try {
            const balance = walletBalanceSchema.parse(await unwrapEnvelope<unknown>(balanceRes));
            availableCredits = balance.availableCredits;
          } catch {
            availableCredits = null;
          }
        } else {
          // The balance is supplementary here (it only annotates the form), so a
          // failure degrades to "unknown" rather than failing the page — but it
          // is logged so a broken read is not indistinguishable from an absent
          // one in the logs.
          console.warn(`GET /api/wallet/balance failed: HTTP ${balanceRes.status}`);
        }

        if (active) setLoad({ phase: 'ready', booking, availableCredits });
      } catch (error) {
        if (active) {
          setLoad({
            phase: 'error',
            message: error instanceof Error ? error.message : t('form.errorTitle'),
          });
        }
      }
    }

    void loadBooking();
    return () => {
      active = false;
    };
  }, [bookingId, t]);

  const trimmedComment = comment.trim();
  const canSubmit =
    trimmedComment.length > 0 && submit.phase !== 'submitting' && submit.phase !== 'success';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    // Validate against the same contract the backend enforces, so an empty or
    // over-long comment fails here instead of silently appearing to succeed.
    const parsed = createRatingSchema.safeParse({
      stars: overallRating,
      comment: trimmedComment,
    });
    if (!parsed.success) {
      setSubmit({ phase: 'error', message: t('commentRequired') });
      return;
    }

    setSubmit({ phase: 'submitting' });
    try {
      const res = await callApi(`/classes/bookings/${bookingId}/rating`, {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });

      if (!res.ok) {
        setSubmit({ phase: 'error', message: await readRatingError(res, t) });
        return;
      }

      ratingViewSchema.parse(await unwrapEnvelope<unknown>(res));
      setSubmit({ phase: 'success' });
      setTimeout(() => {
        router.push(`/${locale}/bookings`);
      }, 2500);
    } catch (error) {
      setSubmit({
        phase: 'error',
        message: error instanceof Error ? error.message : t('form.errorTitle'),
      });
    }
  };

  if (load.phase !== 'ready') {
    return <ReviewStateBlock state={load} t={t} locale={locale} />;
  }

  const { booking, availableCredits } = load;
  const price = booking.priceCredits;
  const platformFee = computePlatformFee(price);
  const teacherNet = computeNetCredits(price);
  const platformPct = Math.round((platformFee / price) * 100);
  const teacherPct = 100 - platformPct;
  const durationMinutes = booking.classSummary.durationMinutes;
  const startsAt = new Date(booking.classSummary.startsAt);

  return (
    <div className="w-full space-y-6">
      {/* 1. Milestone stepper */}
      <nav
        aria-label={t('steps.step1')}
        className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 text-xs font-medium"
      >
        <div className="flex items-center gap-2 font-semibold text-emerald-700">
          <span className="material-symbols-outlined text-[18px] text-emerald-600">
            videocam_off
          </span>
          <span>{t('steps.step1')}</span>
        </div>

        <div className="mx-3 hidden h-0.5 flex-1 bg-emerald-200 sm:block" />

        <div className="flex items-center gap-2 font-semibold text-emerald-700">
          <span className="material-symbols-outlined text-[18px] text-emerald-600">verified</span>
          <span>{t('steps.step2')}</span>
        </div>

        <div className="mx-3 hidden h-0.5 flex-1 bg-slate-200 sm:block" />

        <div className="flex items-center gap-2 font-bold text-slate-900">
          <span className="material-symbols-outlined text-[18px] text-amber-500">star</span>
          <span>{t('steps.step3')}</span>
        </div>
      </nav>

      {/* 2. Session summary banner (real booking data) */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-6 text-white shadow-sm sm:p-7">
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span className="material-symbols-outlined text-[15px]">task_alt</span>
              <span>{t('banner.badge')}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {t('banner.title')}
            </h1>
            <p className="max-w-xl text-sm text-slate-300">{t('banner.subtitle')}</p>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2.5 sm:flex-row md:flex-col md:items-end">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3.5 py-1.5 backdrop-blur-md">
              <span className="text-[11px] font-medium text-slate-300">
                {t('banner.bookingCode', { code: booking.bookingId.slice(0, 12) })}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <span className="material-symbols-outlined text-[16px] text-emerald-400">
                schedule
              </span>
              <span>{t('banner.duration', { minutes: durationMinutes })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main grid: settlement + dossier, review form */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-5">
          {/* Card 1: session info */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t('sessionInfo.title')}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {t('sessionInfo.tag')}
              </span>
            </div>

            <div className="flex items-start gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-100 text-emerald-800 shadow-sm">
                <span className="material-symbols-outlined text-[26px]">
                  {skillIcon(booking)}
                </span>
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow">
                  <span className="material-symbols-outlined text-[12px]">check</span>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold leading-snug text-slate-900">
                  {booking.classSummary.description}
                </h2>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">
                    {booking.classSummary.teacherDisplayName}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="text-xs text-slate-500">{t('sessionInfo.peerStudent')}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
              <div className="rounded-lg border border-slate-200/60 bg-white p-2.5">
                <div className="text-[11px] font-medium text-slate-500">
                  {t('sessionInfo.startsAtLabel')}
                </div>
                <div className="mt-0.5 truncate text-xs font-bold text-slate-900">
                  {startsAt.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200/60 bg-white p-2.5">
                <div className="text-[11px] font-medium text-slate-500">
                  {t('sessionInfo.durationLabel')}
                </div>
                <div className="mt-0.5 text-xs font-bold text-emerald-700">
                  {t('sessionInfo.durationValue', { minutes: durationMinutes })}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: escrow settlement, derived from the real price */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-emerald-600">
                  account_balance
                </span>
                <h3 className="text-base font-bold text-slate-900">{t('escrow.title')}</h3>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                {t('escrow.status')}
              </span>
            </div>

            <p className="text-xs leading-relaxed text-slate-600">{t('escrow.desc')}</p>

            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-slate-900">
                <span className="text-sm font-medium">{t('escrow.totalCost')}</span>
                <span className="text-lg font-bold text-slate-900">
                  {t('escrow.credits', { n: price })}
                </span>
              </div>

              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-emerald-600"
                  style={{ width: `${teacherPct}%` }}
                  title={t('escrow.tutorShare')}
                />
                <div
                  className="h-full bg-slate-400"
                  style={{ width: `${platformPct}%` }}
                  title={t('escrow.platformShare')}
                />
              </div>

              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex items-center justify-between text-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    <span>{t('escrow.tutorShare')}</span>
                  </div>
                  <span className="font-bold text-emerald-700">
                    {t('escrow.credits', { n: teacherNet })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span>{t('escrow.platformShare')}</span>
                  </div>
                  <span className="font-semibold text-slate-700">
                    {t('escrow.credits', { n: platformFee })}
                  </span>
                </div>
              </div>

              <p className="border-t border-slate-200 pt-2 text-[11px] text-slate-500">
                {t('escrow.vndNote', { vnd: computeVndEstimate(price).toLocaleString('vi-VN') })}
              </p>
            </div>

            {availableCredits !== null && (
              <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-left">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">
                    account_balance_wallet
                  </span>
                  <span className="text-xs text-slate-800">
                    {t('escrow.availableBalance')}{' '}
                    <strong className="font-bold text-emerald-800">
                      {t('escrow.credits', { n: availableCredits })}
                    </strong>
                  </span>
                </div>
                <Link
                  href={`/${locale}/wallet`}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  {t('escrow.viewWallet')}
                </Link>
              </div>
            )}
          </div>

          {/* Card 3: materials — honestly unavailable */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <span className="material-symbols-outlined text-[20px] text-slate-400">
                  assignment_turned_in
                </span>
                <span>{t('materials.title')}</span>
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              {t('unavailable.materials')}
            </p>
          </div>
        </div>

        {/* Right column: review form */}
        <div className="space-y-5 lg:col-span-7">
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="space-y-1.5 border-b border-slate-100 pb-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  {t('form.badge')}
                </span>
                <span className="text-xs text-slate-400">{t('form.counterpart')}</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">{t('form.title')}</h2>
              <p className="text-sm text-slate-600">{t('form.subtitle')}</p>
            </div>

            {/* Overall rating — this is the value that is submitted */}
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 text-center">
              <span className="block text-sm font-bold text-slate-900">
                {t('form.overallSatisfaction')}
              </span>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const isActive = star <= overallRating;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setOverallRating(star)}
                      aria-label={`${star} star`}
                      aria-pressed={isActive}
                      className="group p-1 transition-transform hover:scale-125 focus:outline-none"
                    >
                      <span
                        className={`material-symbols-outlined text-[38px] transition-colors ${
                          isActive ? 'text-amber-400' : 'text-slate-300 group-hover:text-amber-300'
                        }`}
                        style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        star
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Private self-assessment criteria */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">{t('form.criteriaTitle')}</h3>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
                {t('form.criteriaNote')}
              </p>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[1, 2, 3, 4].map((criterion) => (
                  <div
                    key={criterion}
                    className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5"
                  >
                    <div className="flex items-center justify-between text-slate-900">
                      <span className="text-xs font-semibold">
                        {t(`form.crit${criterion}` as 'form.crit1')}
                      </span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() =>
                              setCriteriaRatings((prev) => ({ ...prev, [criterion]: s }))
                            }
                            className="focus:outline-none"
                            aria-label={`Criterion ${criterion} rate ${s}`}
                            aria-pressed={s <= (criteriaRatings[criterion] ?? 5)}
                          >
                            <span
                              className={`material-symbols-outlined text-[16px] ${
                                s <= (criteriaRatings[criterion] ?? 5)
                                  ? 'text-amber-400'
                                  : 'text-slate-300'
                              }`}
                              style={{
                                fontVariationSettings:
                                  s <= (criteriaRatings[criterion] ?? 5)
                                    ? "'FILL' 1"
                                    : "'FILL' 0",
                              }}
                            >
                              star
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-colors duration-300"
                        style={{ width: `${((criteriaRatings[criterion] ?? 5) / 5) * 100}%` }}
                      />
                    </div>
                    <span className="block text-[11px] text-slate-500">
                      {t(`form.crit${criterion}Desc` as 'form.crit1Desc')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Written review — required by the contract */}
            <div className="space-y-2">
              <label htmlFor="reviewComment" className="block text-sm font-bold text-slate-900">
                {t('form.commentLabel')}
              </label>
              <p className="text-xs text-slate-500">{t('form.commentHint')}</p>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {[1, 2, 3, 4].map((chip) => {
                  const chipText = t(`form.chip${chip}` as 'form.chip1');
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() =>
                        setComment((prev) =>
                          prev.includes(chipText) ? prev : prev ? `${prev}. ${chipText}` : chipText,
                        )
                      }
                      className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      + {chipText}
                    </button>
                  );
                })}
              </div>

              <textarea
                id="reviewComment"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('form.commentPlaceholder')}
                maxLength={1000}
                aria-required="true"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
              <p className="text-right text-[11px] text-slate-400">{comment.length}/1000</p>
              {trimmedComment.length === 0 && (
                <p className="text-xs font-medium text-slate-500">{t('form.commentRequired')}</p>
              )}
            </div>

            {submit.phase === 'error' && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
              >
                {submit.message}
              </p>
            )}

            <div className="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row">
              <Link
                href={`/${locale}/bookings`}
                className="w-full rounded-full border border-slate-200 px-5 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 sm:w-auto"
              >
                {t('form.btnBack')}
              </Link>

              <button
                type="submit"
                disabled={!canSubmit}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors sm:w-auto ${
                  submit.phase === 'success'
                    ? 'cursor-default bg-emerald-600'
                    : submit.phase === 'submitting'
                      ? 'cursor-wait bg-emerald-700 opacity-80'
                      : canSubmit
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'cursor-not-allowed bg-slate-300'
                }`}
              >
                {submit.phase === 'submitting' ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">
                      progress_activity
                    </span>
                    <span>{t('form.btnSubmitting')}</span>
                  </>
                ) : submit.phase === 'success' ? (
                  <>
                    <span className="material-symbols-outlined text-[18px]">done_all</span>
                    <span>{t('form.btnSuccess')}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    <span>{t('form.btnSubmit')}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {submit.phase === 'success' && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-emerald-900">
                  {t('form.toastSuccessTitle')}
                </div>
                <div className="mt-0.5 text-xs text-emerald-700">{t('form.toastSuccessBody')}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Non-form states: loading, signed out, missing, not eligible, already rated. */
function ReviewStateBlock({
  state,
  t,
  locale,
}: {
  state: Exclude<LoadState, { phase: 'ready' }>;
  t: ReturnType<typeof useTranslations<'PostSessionReview'>>;
  locale: string;
}) {
  const map = {
    loading: { title: t('states.loading'), body: t('states.loadingBody'), href: null },
    'signed-out': {
      title: t('states.signedOutTitle'),
      body: t('states.signedOutBody'),
      href: `/${locale}/auth`,
    },
    'not-found': {
      title: t('states.notFoundTitle'),
      body: t('states.notFoundBody'),
      href: `/${locale}/bookings`,
    },
    'not-eligible': {
      title: t('states.notEligibleTitle'),
      body: t('states.notEligibleBody'),
      href: `/${locale}/bookings`,
    },
    'already-rated': {
      title: t('states.ratedTitle'),
      body: t('states.ratedBody'),
      href: `/${locale}/bookings`,
    },
    error: { title: t('form.errorTitle'), body: state.phase === 'error' ? state.message : '', href: null },
  } as const;

  const entry = map[state.phase];

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
      <h2 className="text-base font-bold text-slate-900">{entry.title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-slate-600">{entry.body}</p>
      {entry.href !== null && (
        <Link
          href={entry.href}
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          {t('form.btnBack')}
        </Link>
      )}
    </div>
  );
}

/**
 * Turns a rejected rating into a message. The backend distinguishes
 * "already rated" (409) from "not eligible" (400/404), so the status code is
 * mapped to the matching translation and any other message is passed through.
 */
async function readRatingError(
  res: Response,
  t: ReturnType<typeof useTranslations<'PostSessionReview'>>,
): Promise<string> {
  if (res.status === 409) return t('form.errorAlreadyRated');
  if (res.status === 400 || res.status === 404) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return body?.message ?? t('form.errorNotEligible');
  }
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? t('form.errorTitle');
}
