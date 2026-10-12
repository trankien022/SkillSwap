'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface PostSessionReviewProps {
  bookingId?: string;
}

export function PostSessionReviewContent({ bookingId = 'SS-VN-8821' }: PostSessionReviewProps) {
  const t = useTranslations('PostSessionReview');
  const locale = useLocale();
  const router = useRouter();

  // Ratings state
  const [overallRating, setOverallRating] = useState<number>(5);
  const [criteriaRatings, setCriteriaRatings] = useState<{ [key: number]: number }>({
    1: 5,
    2: 5,
    3: 5,
    4: 5,
  });

  // Textarea & suggestions state
  const [comment, setComment] = useState<string>(t('form.defaultComment'));
  const [crossMatch1, setCrossMatch1] = useState<boolean>(true);
  const [crossMatch2, setCrossMatch2] = useState<boolean>(false);

  // Submit flow state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const starTexts: { [key: number]: string } = {
    1: t('form.star1'),
    2: t('form.star2'),
    3: t('form.star3'),
    4: t('form.star4'),
    5: t('form.star5'),
  };

  const chips = [
    t('form.chip1'),
    t('form.chip2'),
    t('form.chip3'),
    t('form.chip4'),
  ];

  const handleAddChip = (chipText: string) => {
    if (!comment.includes(chipText)) {
      setComment((prev) => (prev ? `${prev}. ${chipText}` : chipText));
    }
  };

  const handleDownload = (filename: string) => {
    setDownloadNotice(locale === 'vi' ? `Đang tải xuống tệp: ${filename}` : `Downloading file: ${filename}`);
    setTimeout(() => {
      setDownloadNotice(null);
    }, 2500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isSuccess) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        router.push(`/${locale}/bookings`);
      }, 2500);
    }, 700);
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Milestone Stepper */}
      <nav aria-label="Progress Stepper" className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 text-xs font-medium">
        <div className="flex items-center gap-2 font-semibold text-emerald-700">
          <span className="material-symbols-outlined text-[18px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>
            videocam_off
          </span>
          <span>{t('steps.step1')}</span>
        </div>

        <div className="hidden h-0.5 flex-1 bg-emerald-200 sm:block mx-3" />

        <div className="flex items-center gap-2 font-semibold text-emerald-700">
          <span className="material-symbols-outlined text-[18px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified
          </span>
          <span>{t('steps.step2')}</span>
        </div>

        <div className="hidden h-0.5 flex-1 bg-slate-200 sm:block mx-3" />

        <div className="flex items-center gap-2 font-bold text-slate-900">
          <span className="material-symbols-outlined text-[18px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>
            star
          </span>
          <span>{t('steps.step3')}</span>
        </div>
      </nav>

      {/* 2. Celebration Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-7 text-white shadow-sm border border-slate-800">
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
              <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                task_alt
              </span>
              <span>{t('banner.badge')}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {t('banner.title')}
            </h1>
            <p className="text-sm text-slate-300 max-w-xl">
              {t('banner.subtitle')}
            </p>
          </div>

          <div className="flex shrink-0 flex-col sm:flex-row md:flex-col items-start md:items-end gap-2.5">
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-1.5 backdrop-blur-md border border-white/10">
              <span className="text-[11px] font-medium text-slate-300">{t('banner.bookingCode', { code: bookingId })}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
              <span className="material-symbols-outlined text-[16px] text-emerald-400">schedule</span>
              <span>{t('banner.duration')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Grid (Settlement & Session Dossier vs Review Form) */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left Column (Settlement & Session Dossier) */}
        <div className="space-y-5 lg:col-span-5">
          {/* Card 1: Session Info */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t('sessionInfo.title')}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {t('sessionInfo.tag')}
              </span>
            </div>

            <div className="flex items-start gap-4">
              <div className="relative h-14 w-14 shrink-0 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xl shadow-sm border border-emerald-200">
                LA
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow">
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold leading-snug text-slate-900">
                  {t('sessionInfo.classTitle')}
                </h2>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">
                    {t('sessionInfo.tutor')}
                  </span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="text-xs text-slate-500">
                    {t('sessionInfo.university')}
                  </span>
                </div>
                <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-100">
                  <span className="material-symbols-outlined text-[13px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>
                    verified_user
                  </span>
                  <span>{t('sessionInfo.verifiedBadge')}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-center border border-slate-100">
              <div className="rounded-lg bg-white p-2.5 border border-slate-200/60 shadow-2xs">
                <div className="text-[11px] text-slate-500 font-medium">{t('sessionInfo.topicLabel')}</div>
                <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
                  {t('sessionInfo.topicValue')}
                </div>
              </div>
              <div className="rounded-lg bg-white p-2.5 border border-slate-200/60 shadow-2xs">
                <div className="text-[11px] text-slate-500 font-medium">{t('sessionInfo.jitsiLabel')}</div>
                <div className="text-xs font-bold text-emerald-700 mt-0.5">
                  {t('sessionInfo.jitsiValue')}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Escrow Settlement */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px] text-emerald-600">
                  account_balance
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {t('escrow.title')}
                </h3>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                {t('escrow.status')}
              </span>
            </div>

            <p className="text-xs leading-relaxed text-slate-600">
              {t('escrow.desc')}
            </p>

            <div className="space-y-3 rounded-xl bg-slate-50 p-4 border border-slate-100">
              <div className="flex items-center justify-between text-slate-900">
                <span className="text-sm font-medium">{t('escrow.totalCost')}</span>
                <span className="text-lg font-bold text-slate-900">
                  {t('escrow.credits', { n: 90 })}
                </span>
              </div>

              {/* Progress bar (90% tutor, 10% platform fee) */}
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-emerald-600" style={{ width: '90%' }} title="Tutor 90%" />
                <div className="h-full bg-slate-400" style={{ width: '10%' }} title="Platform 10%" />
              </div>

              <div className="space-y-1.5 pt-1 text-xs">
                <div className="flex items-center justify-between text-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    <span>{t('escrow.tutorShare')}</span>
                  </div>
                  <span className="font-bold text-emerald-700">+81 Credit</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span>{t('escrow.platformShare')}</span>
                  </div>
                  <span className="font-semibold text-slate-700">9 Credit</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-emerald-50/70 border border-emerald-100 p-3 text-left">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-emerald-600">
                  account_balance_wallet
                </span>
                <span className="text-xs text-slate-800">
                  {t('escrow.availableBalance')} <strong className="font-bold text-emerald-800">150 Credit</strong>
                </span>
              </div>
              <Link
                href={`/${locale}/wallet`}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
              >
                {t('escrow.viewWallet')}
              </Link>
            </div>
          </div>

          {/* Card 3: Materials & Notes Download */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <span className="material-symbols-outlined text-[20px] text-emerald-600">
                  assignment_turned_in
                </span>
                <span>{t('materials.title')}</span>
              </h3>
              <span className="text-xs font-semibold text-slate-500">{t('materials.count')}</span>
            </div>

            <p className="text-xs text-slate-600">
              {t('materials.desc')}
            </p>

            {downloadNotice && (
              <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 border border-emerald-200">
                {downloadNotice}
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleDownload('Speaking_Critique_SS8821.pdf')}
                className="group flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:bg-slate-100 hover:border-slate-300"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-2xs">
                    <span className="material-symbols-outlined text-[18px]">description</span>
                  </div>
                  <div className="truncate">
                    <div className="truncate text-xs font-semibold text-slate-900">
                      {t('materials.file1Name')}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {t('materials.file1Meta')}
                    </div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[20px] text-slate-400 transition-colors group-hover:text-emerald-700">
                  download
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDownload('Audio_Sample_Intonation.mp3')}
                className="group flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition-colors hover:bg-slate-100 hover:border-slate-300"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-white shadow-2xs">
                    <span className="material-symbols-outlined text-[18px]">mic</span>
                  </div>
                  <div className="truncate">
                    <div className="truncate text-xs font-semibold text-slate-900">
                      {t('materials.file2Name')}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {t('materials.file2Meta')}
                    </div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[20px] text-slate-400 transition-colors group-hover:text-emerald-700">
                  download
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (Review Form & Skill Swap Matching Form) */}
        <div className="space-y-5 lg:col-span-7">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6"
          >
            {/* Form Header */}
            <div className="space-y-1.5 pb-2 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    verified
                  </span>
                  {t('form.badge')}
                </span>
                <span className="text-xs text-slate-400">
                  {t('form.counterpart')}
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                {t('form.title')}
              </h2>
              <p className="text-sm text-slate-600">
                {t('form.subtitle')}
              </p>
            </div>

            {/* Overall Star Rating */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 text-center space-y-2">
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
              <div className="text-sm font-bold text-amber-700">
                {starTexts[overallRating] || starTexts[5]}
              </div>
            </div>

            {/* 4 Core Rating Criteria */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                {t('form.criteriaTitle')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Criterion 1 */}
                <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-center justify-between text-slate-900">
                    <span className="text-xs font-semibold">{t('form.crit1')}</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCriteriaRatings((prev) => ({ ...prev, 1: s }))}
                          className="focus:outline-none"
                          aria-label={`Criterion 1 rate ${s}`}
                        >
                          <span
                            className={`material-symbols-outlined text-[16px] ${
                              s <= (criteriaRatings[1] ?? 5) ? 'text-amber-400' : 'text-slate-300'
                            }`}
                            style={{ fontVariationSettings: s <= (criteriaRatings[1] ?? 5) ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            star
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                      style={{ width: `${((criteriaRatings[1] ?? 5) / 5) * 100}%` }}
                    />
                  </div>
                  <span className="block text-[11px] text-slate-500">
                    {t('form.crit1Desc')}
                  </span>
                </div>

                {/* Criterion 2 */}
                <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-center justify-between text-slate-900">
                    <span className="text-xs font-semibold">{t('form.crit2')}</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCriteriaRatings((prev) => ({ ...prev, 2: s }))}
                          className="focus:outline-none"
                          aria-label={`Criterion 2 rate ${s}`}
                        >
                          <span
                            className={`material-symbols-outlined text-[16px] ${
                              s <= (criteriaRatings[2] ?? 5) ? 'text-amber-400' : 'text-slate-300'
                            }`}
                            style={{ fontVariationSettings: s <= (criteriaRatings[2] ?? 5) ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            star
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                      style={{ width: `${((criteriaRatings[2] ?? 5) / 5) * 100}%` }}
                    />
                  </div>
                  <span className="block text-[11px] text-slate-500">
                    {t('form.crit2Desc')}
                  </span>
                </div>

                {/* Criterion 3 */}
                <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-center justify-between text-slate-900">
                    <span className="text-xs font-semibold">{t('form.crit3')}</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCriteriaRatings((prev) => ({ ...prev, 3: s }))}
                          className="focus:outline-none"
                          aria-label={`Criterion 3 rate ${s}`}
                        >
                          <span
                            className={`material-symbols-outlined text-[16px] ${
                              s <= (criteriaRatings[3] ?? 5) ? 'text-amber-400' : 'text-slate-300'
                            }`}
                            style={{ fontVariationSettings: s <= (criteriaRatings[3] ?? 5) ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            star
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                      style={{ width: `${((criteriaRatings[3] ?? 5) / 5) * 100}%` }}
                    />
                  </div>
                  <span className="block text-[11px] text-slate-500">
                    {t('form.crit3Desc')}
                  </span>
                </div>

                {/* Criterion 4 */}
                <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-center justify-between text-slate-900">
                    <span className="text-xs font-semibold">{t('form.crit4')}</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCriteriaRatings((prev) => ({ ...prev, 4: s }))}
                          className="focus:outline-none"
                          aria-label={`Criterion 4 rate ${s}`}
                        >
                          <span
                            className={`material-symbols-outlined text-[16px] ${
                              s <= (criteriaRatings[4] ?? 5) ? 'text-amber-400' : 'text-slate-300'
                            }`}
                            style={{ fontVariationSettings: s <= (criteriaRatings[4] ?? 5) ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            star
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                      style={{ width: `${((criteriaRatings[4] ?? 5) / 5) * 100}%` }}
                    />
                  </div>
                  <span className="block text-[11px] text-slate-500">
                    {t('form.crit4Desc')}
                  </span>
                </div>
              </div>
            </div>

            {/* Written Review with Quick Suggestion Chips */}
            <div className="space-y-2">
              <label htmlFor="reviewComment" className="block text-sm font-bold text-slate-900">
                {t('form.commentLabel')}
              </label>
              <p className="text-xs text-slate-500">
                {t('form.commentHint')}
              </p>

              {/* Quick suggestion chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {chips.map((chipText, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddChip(chipText)}
                    className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    + {chipText}
                  </button>
                ))}
              </div>

              <textarea
                id="reviewComment"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('form.commentPlaceholder')}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            {/* Skill Swap Cross-Matching Opportunity */}
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-700">
                  <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    swap_horizontal_circle
                  </span>
                  <span className="text-sm font-bold">{t('form.crossMatchTitle')}</span>
                </div>
                <span className="text-xs text-slate-400">{t('form.crossMatchSub')}</span>
              </div>

              <p className="text-xs leading-relaxed text-slate-600">
                {t('form.crossMatchDesc')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer hover:border-emerald-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={crossMatch1}
                    onChange={(e) => setCrossMatch1(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    {t('form.crossMatchOpt1')}
                  </span>
                </label>

                <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer hover:border-emerald-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={crossMatch2}
                    onChange={(e) => setCrossMatch2(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    {t('form.crossMatchOpt2')}
                  </span>
                </label>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <Link
                href={`/${locale}/bookings`}
                className="w-full sm:w-auto rounded-full border border-slate-200 px-5 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                {t('form.btnBack')}
              </Link>

              <button
                type="submit"
                disabled={isSubmitting || isSuccess}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition-all ${
                  isSuccess
                    ? 'bg-emerald-600 cursor-default'
                    : isSubmitting
                    ? 'bg-emerald-700 opacity-80 cursor-wait'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">
                      progress_activity
                    </span>
                    <span>{t('form.btnSubmitting')}</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      done_all
                    </span>
                    <span>{t('form.btnSuccess')}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      send
                    </span>
                    <span>{t('form.btnSubmit')}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Dynamic Success Toast */}
          {isSuccess && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-sm animate-fade-in">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  verified
                </span>
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-emerald-900">
                  {t('form.toastSuccessTitle')}
                </div>
                <div className="text-xs text-emerald-700 mt-0.5">
                  {t('form.toastSuccessBody')}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
