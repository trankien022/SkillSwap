'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Navbar } from '../../../components/navbar';
import { SiteFooter } from '../../../components/landing/SiteFooter';
import { getStoredUser, callApi, unwrapEnvelope, type UserProfile } from '../../../lib/api-client';
import type { MeResponse } from '@skillswap/contracts';

export default function VerificationPage() {
  const t = useTranslations('Verification');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadedMessage, setUploadedMessage] = useState<string | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
    const fetchMe = async () => {
      try {
        const res = await callApi('/auth/me');
        if (res.ok) {
          const data = await unwrapEnvelope<MeResponse>(res);
          setMe(data);
        }
      } catch {
        // Fallback to local stored user
      }
    };
    fetchMe();
  }, []);

  const isApproved = me?.studentVerification?.status === 'approved' || user?.studentVerificationStatus === 'approved';
  const studentName = me?.displayName || user?.displayName || 'Minh Nguyễn';
  const studentEmail = me?.email || user?.email || 'minh.nguyen@student.edu.vn';
  const studentCode = '2112450098';
  const universityName = 'Đại học RMIT (Việt Nam)';

  const handleFakeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const fileName = e.target.files[0].name;
      setUploadedMessage(`Đã tiếp nhận tệp: ${fileName}. Ban thư ký đang đối soát hồ sơ.`);
      setTimeout(() => {
        setIsUploadOpen(false);
      }, 2000);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar currentTab="verification" me={me} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              <span className="material-symbols-outlined text-[16px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>
                verified
              </span>
              <span>{t('badge')}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t('title')}
            </h1>
            <p className="max-w-2xl text-xs sm:text-sm text-slate-600 leading-relaxed">
              {t('subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                <span className="material-symbols-outlined text-[20px]">shield</span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 leading-tight">
                  {t('privacyBadge.title')}
                </p>
                <p className="text-[11px] font-medium text-emerald-700">
                  {t('privacyBadge.subtitle')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Left Column: Student Identity & Card Scan */}
          <div className="space-y-6 lg:col-span-7">
            {/* Card 1: Student Identity Details */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      badge
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900">
                        {t('studentIdCard.title')}
                      </h2>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        {isApproved ? t('studentIdCard.verified') : t('studentIdCard.pending')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{t('studentIdCard.sub')}</p>
                  </div>
                </div>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-600 font-medium">
                  {t('studentIdCard.cohort')}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3.5 pt-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 space-y-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {t('studentIdCard.school')}
                  </span>
                  <p className="text-sm font-bold text-slate-900">{universityName}</p>
                  <p className="text-xs text-slate-500">{t('studentIdCard.schoolSub')}</p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 space-y-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {t('studentIdCard.studentCode')}
                  </span>
                  <p className="font-mono text-sm font-bold text-slate-900">{studentCode}</p>
                  <p className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
                    <span className="material-symbols-outlined text-[13px]">check_circle</span>
                    {t('studentIdCard.studentCodeSub')}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 space-y-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {t('studentIdCard.studentEmail')}
                  </span>
                  <p className="text-sm font-bold text-slate-900 truncate">{studentEmail}</p>
                  <p className="text-xs text-slate-500">{t('studentIdCard.studentEmailSub')}</p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3.5 space-y-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {t('studentIdCard.reverifyTerm')}
                  </span>
                  <p className="text-sm font-bold text-emerald-700">{t('studentIdCard.reverifyTermValue')}</p>
                  <p className="text-xs text-slate-500">{t('studentIdCard.reverifyTermSub')}</p>
                </div>
              </div>
            </section>

            {/* Card 2: Student ID Card Scan Visualization */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{t('cardScan.title')}</h3>
                  <p className="text-xs text-slate-500">{t('cardScan.subtitle')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                  <span>{t('cardScan.updateCta')}</span>
                </button>
              </div>

              {/* Realistic Simulated Student Card */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-6 text-white shadow-md border border-slate-700">
                {/* Diagonal security watermark */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10">
                  <span className="font-mono text-3xl sm:text-4xl font-extrabold tracking-widest uppercase select-none rotate-[-15deg]">
                    {t('cardScan.watermark')}
                  </span>
                </div>

                <div className="relative z-10 flex flex-col justify-between gap-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                        <span className="material-symbols-outlined text-[16px]">lock</span>
                      </span>
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 backdrop-blur-xs">
                        {t('cardScan.internalLock')}
                      </span>
                    </div>
                    <span className="rounded-md bg-black/40 px-2.5 py-1 font-mono text-xs font-bold text-slate-300">
                      MSSV: {studentCode}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 py-2">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 font-bold text-lg text-white shadow-inner">
                      {studentName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold tracking-tight text-white">{studentName}</h4>
                      <p className="text-xs text-slate-300 font-medium">{universityName}</p>
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                        <span className="material-symbols-outlined text-[13px]">verified</span>
                        SkillSwap Verified Student
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between border-t border-white/10 pt-3 text-[11px] text-slate-300">
                    <span>{universityName}</span>
                    <span className="font-mono">{t('cardScan.verifiedOn')}</span>
                  </div>
                </div>
              </div>

              {/* Upload Modal Drawer */}
              {isUploadOpen && (
                <div className="mt-4 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-4 text-center">
                  <label htmlFor="card-upload-input" className="cursor-pointer block">
                    <span className="material-symbols-outlined text-3xl text-emerald-600">upload_file</span>
                    <p className="mt-1 text-xs font-semibold text-slate-900">
                      Nhấp để tải lên ảnh thẻ sinh viên mới (PNG, JPG, PDF)
                    </p>
                    <p className="text-[11px] text-slate-500">Mã hóa đầu cuối & tự động che mờ thông tin nhạy cảm</p>
                    <input
                      id="card-upload-input"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFakeUpload}
                      className="hidden"
                    />
                  </label>
                  {uploadedMessage && (
                    <div className="mt-3 rounded-lg bg-emerald-600 p-2 text-xs font-semibold text-white">
                      {uploadedMessage}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsUploadOpen(false)}
                    className="mt-3 text-xs font-medium text-slate-500 hover:text-slate-800"
                  >
                    Đóng
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Academic Trust Score & Subject Certifications */}
          <div className="space-y-6 lg:col-span-5">
            {/* Card 3: Academic Trust Index */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">{t('trustScore.title')}</h3>
                <span className="rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  {t('trustScore.badge')}
                </span>
              </div>

              {/* Circular Gauge Score */}
              <div className="flex flex-col items-center justify-center py-2">
                <div className="relative flex h-36 w-36 items-center justify-center">
                  <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 120 120">
                    <circle
                      className="text-slate-100"
                      cx="60"
                      cy="60"
                      r="48"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="8"
                    />
                    <circle
                      className="text-emerald-600 transition-all duration-1000"
                      cx="60"
                      cy="60"
                      r="48"
                      fill="transparent"
                      stroke="currentColor"
                      strokeDasharray="301.59"
                      strokeDashoffset="6.03"
                      strokeLinecap="round"
                      strokeWidth="8"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-4xl font-extrabold tracking-tight text-slate-900 leading-none">
                      {t('trustScore.score')}
                    </span>
                    <span className="mt-1 text-[11px] font-semibold uppercase text-slate-400">
                      {t('trustScore.scoreMax')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                    <span className="font-medium">{t('trustScore.completedSessions')}</span>
                  </div>
                  <span className="font-bold text-slate-900">99.4%</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">gavel</span>
                    <span className="font-medium">{t('trustScore.disputes')}</span>
                  </div>
                  <span className="font-bold text-emerald-700">{t('trustScore.disputesValue')}</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="material-symbols-outlined text-[18px] text-amber-500">star</span>
                    <span className="font-medium">{t('trustScore.peerRating')}</span>
                  </div>
                  <span className="font-bold text-slate-900">4.9 / 5.0 ★</span>
                </div>
              </div>

              <p className="mt-4 text-center text-xs text-slate-500 leading-relaxed">
                {t('trustScore.endorsement')}
              </p>
            </section>

            {/* Card 4: Certified Skills */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">{t('certifications.title')}</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {t('certifications.summary')}
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{t('certifications.ielts')}</p>
                      <p className="text-[11px] text-slate-500">{t('certifications.ieltsSub')}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    Đã duyệt
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{t('certifications.toeic')}</p>
                      <p className="text-[11px] text-slate-500">{t('certifications.toeicSub')}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    Đã duyệt
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                      <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{t('certifications.translation')}</p>
                      <p className="text-[11px] text-slate-500">{t('certifications.translationSub')}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                    {t('certifications.pendingBadge')}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Card 5: Bottom Pledge */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs">
          <div className="mb-6 max-w-xl text-center mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {t('pledge.title')}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed">
              {t('pledge.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 space-y-1.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <span className="material-symbols-outlined text-[20px]">school</span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                {t('pledge.item1Title')}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t('pledge.item1Body')}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 space-y-1.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <span className="material-symbols-outlined text-[20px]">lock_person</span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                {t('pledge.item2Title')}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t('pledge.item2Body')}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 space-y-1.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <span className="material-symbols-outlined text-[20px]">autorenew</span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                {t('pledge.item3Title')}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t('pledge.item3Body')}
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
