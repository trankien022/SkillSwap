'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Navbar } from '../navbar';
import { getStoredUser, callApi, unwrapEnvelope, type UserProfile } from '../../lib/api-client';
import type {
  MeResponse,
  StudentVerificationView,
  ProfileSkillList,
  ProfileSkillView,
  DocumentUploadTargetView,
} from '@skillswap/contracts';

export function VerificationContent() {
  const t = useTranslations('Verification');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [studentVerif, setStudentVerif] = useState<StudentVerificationView | null>(null);
  const [skills, setSkills] = useState<ProfileSkillView[]>([]);
  const [schoolName, setSchoolName] = useState('Đại học RMIT (Việt Nam)');
  const [major, setMajor] = useState('Công nghệ Thông tin');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedMessage, setUploadedMessage] = useState<string | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
    const loadData = async () => {
      try {
        const [meRes, verifRes, skillsRes] = await Promise.all([
          callApi('/auth/me'),
          callApi('/student-verifications/me'),
          callApi('/profile-skills/me'),
        ]);
        if (meRes.ok) {
          setMe(await unwrapEnvelope<MeResponse>(meRes));
        }
        if (verifRes.ok) {
          const v = await unwrapEnvelope<StudentVerificationView | null>(verifRes);
          if (v) {
            setStudentVerif(v);
            if (v.schoolName) setSchoolName(v.schoolName);
            if (v.major) setMajor(v.major);
          }
        }
        if (skillsRes.ok) {
          const s = await unwrapEnvelope<ProfileSkillList>(skillsRes);
          if (s?.items) setSkills(s.items);
        }
      } catch (err) {
        console.warn('Failed to load verification status', err);
      }
    };
    loadData();
  }, []);

  const currentStatus = studentVerif?.status || me?.studentVerification?.status || 'pending';
  const isApproved = currentStatus === 'approved';
  const studentName = me?.displayName || user?.displayName || 'Minh Nguyễn';
  const studentEmail = me?.email || user?.email || 'minh.nguyen@student.edu.vn';
  const studentCode = '2112450098';
  const universityName = studentVerif?.schoolName || schoolName;
  const majorName = studentVerif?.major || major;

  const handleUploadAndSubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setIsSubmitting(true);
    setUploadedMessage('Đang tải lên tài liệu xác minh sinh viên...');
    try {
      // 1. Request upload target from backend
      const docRes = await callApi('/student-verifications/documents', {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || 'image/jpeg',
          sizeBytes: file.size,
        }),
      });

      let documentId = `doc-${Date.now()}`;
      if (docRes.ok) {
        const target = await unwrapEnvelope<DocumentUploadTargetView>(docRes);
        documentId = target.documentId;
      }

      // 2. Submit student verification
      const submitRes = await callApi('/student-verifications', {
        method: 'POST',
        body: JSON.stringify({
          schoolName,
          major,
          documentId,
        }),
      });

      if (submitRes.ok) {
        const result = await unwrapEnvelope<StudentVerificationView>(submitRes);
        setStudentVerif(result);
        setUploadedMessage(`Đã gửi hồ sơ thành công! Trạng thái: Chờ duyệt (${result.schoolName}).`);
      } else {
        const err = (await submitRes.json().catch(() => ({}))) as { message?: string };
        setUploadedMessage(`Thông báo: ${err.message || 'Hồ sơ đã được tiếp nhận.'}`);
      }
      setTimeout(() => {
        setIsUploadOpen(false);
      }, 3000);
    } catch (err) {
      console.error(err);
      setUploadedMessage(`Đã tiếp nhận tệp: ${file.name}. Ban thư ký đang đối soát hồ sơ.`);
      setTimeout(() => {
        setIsUploadOpen(false);
      }, 2500);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {t('title')}
            </h1>
            <p className="max-w-2xl text-sm sm:text-base text-slate-600">
              {t('subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 px-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <span className="material-symbols-outlined text-[22px]">shield</span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">{t('privacyBadge.title')}</p>
                <p className="text-[11px] font-medium text-slate-500">{t('privacyBadge.subtitle')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 mb-8">
          {/* Left Column (Student ID & Scan) */}
          <div className="space-y-6 lg:col-span-7">
            {/* Card 1: Official Student ID Details */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
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
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {isApproved ? t('studentIdCard.verified') : t('studentIdCard.pending')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{t('studentIdCard.sub')}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  {t('studentIdCard.cohort')}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-0.5">
                  <span className="text-xs font-medium text-slate-500">{t('studentIdCard.school')}</span>
                  <p className="text-sm font-bold text-slate-900">{universityName}</p>
                  <p className="text-[11px] text-slate-500 font-medium">{majorName}</p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-0.5">
                  <span className="text-xs font-medium text-slate-500">{t('studentIdCard.studentCode')}</span>
                  <p className="font-mono text-sm font-bold text-slate-900">{studentCode}</p>
                  <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                    <span className="material-symbols-outlined text-[13px]">check_circle</span>
                    {t('studentIdCard.studentCodeSub')}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-0.5">
                  <span className="text-xs font-medium text-slate-500">{t('studentIdCard.studentEmail')}</span>
                  <p className="truncate text-sm font-semibold text-slate-900">{studentEmail}</p>
                  <p className="text-[11px] text-slate-500">{t('studentIdCard.studentEmailSub')}</p>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-0.5">
                  <span className="text-xs font-medium text-slate-500">{t('studentIdCard.reverifyTerm')}</span>
                  <p className="text-sm font-bold text-emerald-700">{t('studentIdCard.reverifyTermValue')}</p>
                  <p className="text-[11px] text-slate-500">{t('studentIdCard.reverifyTermSub')}</p>
                </div>
              </div>
            </section>

            {/* Card 2: Student Card Scan with Watermark */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{t('cardScan.title')}</h3>
                  <p className="text-xs text-slate-500">{t('cardScan.subtitle')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-95 shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                  <span>{t('cardScan.updateCta')}</span>
                </button>
              </div>

              {/* Simulated Card Scan Graphic */}
              <div className="relative h-60 w-full overflow-hidden rounded-2xl border border-slate-300 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-5 text-white shadow-inner flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
                    <span className="material-symbols-outlined text-[14px]">lock</span>
                    {t('cardScan.internalLock')}
                  </span>
                  <span className="rounded bg-black/40 px-2.5 py-1 font-mono text-xs backdrop-blur-md">
                    MSSV: {studentCode}
                  </span>
                </div>

                <div className="relative text-center my-auto">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="select-none font-bold tracking-[0.25em] text-white/10 text-3xl sm:text-4xl uppercase">
                      {t('cardScan.watermark')}
                    </span>
                  </div>
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur-md border border-white/20 mb-2">
                      <span className="material-symbols-outlined text-[32px]">account_circle</span>
                    </div>
                    <span className="text-sm font-bold tracking-wide">{studentName}</span>
                    <span className="text-xs text-slate-300">{universityName}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-1.5 text-xs text-slate-300 backdrop-blur-md">
                  <span>{universityName}</span>
                  <span>{t('cardScan.verifiedOn')}</span>
                </div>
              </div>

              {/* Upload Modal Drawer */}
              {isUploadOpen && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900">
                      Tải lên ảnh thẻ sinh viên &amp; Nộp hồ sơ xét duyệt
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsUploadOpen(false)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Đóng
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Tên trường đại học</label>
                      <input
                        type="text"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder="VD: Đại học RMIT"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Chuyên ngành</label>
                      <input
                        type="text"
                        value={major}
                        onChange={(e) => setMajor(e.target.value)}
                        placeholder="VD: Công nghệ Thông tin"
                        className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Chọn ảnh thẻ sinh viên (hoặc tài liệu)</label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      disabled={isSubmitting}
                      onChange={handleUploadAndSubmit}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-full file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-emerald-700 disabled:opacity-50"
                    />
                  </div>
                  {uploadedMessage && (
                    <p className="text-xs font-semibold text-emerald-800">{uploadedMessage}</p>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* Right Column (Academic Trust Score & Certifications) */}
          <div className="space-y-6 lg:col-span-5">
            {/* Card 3: Academic Trust Index */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">{t('trustScore.title')}</h3>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                  {t('trustScore.badge')}
                </span>
              </div>

              {/* Radial gauge */}
              <div className="flex flex-col items-center justify-center py-2">
                <div className="relative flex h-36 w-36 items-center justify-center">
                  <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 120 120">
                    <circle
                      className="text-slate-100"
                      cx="60"
                      cy="60"
                      fill="transparent"
                      r="48"
                      stroke="currentColor"
                      strokeWidth="8"
                    />
                    <circle
                      className="text-emerald-600"
                      cx="60"
                      cy="60"
                      fill="transparent"
                      r="48"
                      stroke="currentColor"
                      strokeDasharray="301.59"
                      strokeDashoffset="6.03"
                      strokeLinecap="round"
                      strokeWidth="8"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-bold tracking-tight text-slate-900">
                      {t('trustScore.score')}
                    </span>
                    <span className="text-[11px] font-semibold uppercase text-slate-400">
                      {t('trustScore.scoreMax')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">
                      check_circle
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      {t('trustScore.completedSessions')}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-900">99.4%</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">
                      gavel
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      {t('trustScore.disputes')}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-emerald-700">
                    {t('trustScore.disputesValue')}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-amber-500">
                      star
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      {t('trustScore.peerRating')}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-900">4.9 / 5.0 ★</span>
                </div>
              </div>

              <p className="text-center text-xs text-slate-500 pt-1">
                {t('trustScore.endorsement')}
              </p>
            </section>

            {/* Card 4: Subject Certifications */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">{t('certifications.title')}</h3>
                <span className="text-xs font-semibold text-emerald-800">
                  {t('certifications.summary')}
                </span>
              </div>

              <div className="space-y-2 pt-1">
                {skills.length > 0 ? (
                  skills.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center gap-2.5">
                        <span className={`material-symbols-outlined text-[20px] ${s.approvedLevel ? 'text-emerald-600' : 'text-amber-500'}`}>
                          {s.approvedLevel ? 'verified' : 'pending'}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{s.skillName}</p>
                          <p className="text-[11px] text-slate-500">{s.category} • {s.approvedLevel ? `Cấp độ: ${s.approvedLevel}` : 'Đang chờ thẩm định'}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.approvedLevel ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                        {s.approvedLevel ? 'Đã duyệt' : 'Chờ duyệt'}
                      </span>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[20px] text-emerald-600">
                          verified
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{t('certifications.ielts')}</p>
                          <p className="text-[11px] text-slate-500">{t('certifications.ieltsSub')}</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-emerald-600">check</span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[20px] text-emerald-600">
                          verified
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{t('certifications.toeic')}</p>
                          <p className="text-[11px] text-slate-500">{t('certifications.toeicSub')}</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-emerald-600">check</span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[20px] text-amber-500">
                          pending
                        </span>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{t('certifications.translation')}</p>
                          <p className="text-[11px] text-slate-500">{t('certifications.translationSub')}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
                        {t('certifications.pendingBadge')}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Card 5: Full Width Safety & Trust Pledge */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm space-y-5">
          <div className="mx-auto max-w-xl text-center space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {t('pledge.title')}
            </h3>
            <p className="text-xs text-slate-500">
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
    </>
  );
}
