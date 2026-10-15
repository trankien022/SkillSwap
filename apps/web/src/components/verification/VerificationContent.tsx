'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PageIntro } from '../ui/PageIntro';
import { StatePanel } from '../ui/StatePanel';
import { WorkspaceFooter } from '../ui/WorkspaceFooter';
import { Navbar } from '../navbar';
import { getTokens, getStoredUser, callApi, unwrapEnvelope, type UserProfile } from '../../lib/api-client';import type {
  MeResponse,
  StudentVerificationView,
  ProfileSkillList,
  ProfileSkillView,
  DocumentUploadTargetView,
} from '@skillswap/contracts';

export function VerificationContent() {
  const t = useTranslations('Workspace.verification');
  const locale = useLocale();
  const [signedIn, setSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [studentVerif, setStudentVerif] = useState<StudentVerificationView | null>(null);
  const [skills, setSkills] = useState<ProfileSkillView[]>([]);
  const [schoolName, setSchoolName] = useState('');
  const [major, setMajor] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedMessage, setUploadedMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const hasSession = Boolean(getTokens());
    setSignedIn(hasSession);
    if (!hasSession) { setIsLoading(false); return; }
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
        } else if (verifRes.status !== 404) {
          // 404 is `null` for "no submission yet" on this route and is expected;
          // anything else means the status could not be read and is reported
          // rather than rendered as "pending", which is a different claim.
          setLoadError(t('loadError'));
        }
        if (skillsRes.ok) {
          const s = await unwrapEnvelope<ProfileSkillList>(skillsRes);
          if (s?.items) setSkills(s.items);
        }
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : t('loadError'),
        );
      } finally { setIsLoading(false); }
    };
    loadData();
  }, []);

  const currentStatus = studentVerif?.status || me?.studentVerification?.status || 'unsubmitted';

  const handleUploadAndSubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setIsSubmitting(true);
    setUploadedMessage(null);
    setUploadError(null);
    setUploadProgress(0);

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

      if (!docRes.ok) {
        const err = (await docRes.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message || t('uploadError'));
      }

      const target = await unwrapEnvelope<DocumentUploadTargetView>(docRes);
      const { documentId, uploadUrl } = target;

      // 2. PUT raw file bytes to the pre-signed uploadUrl (no auth header)
      setIsUploading(true);
      setUploadProgress(0);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        // Do not set authorization header — pre-signed URL should be used without bearer token.
        if (file.type) {
          try {
            xhr.setRequestHeader('content-type', file.type);
          } catch {
            // some environments disallow setting content-type on presigned PUT, ignore
          }
        }
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            const p = Math.round((ev.loaded / ev.total) * 100);
            setUploadProgress(p);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error(t('uploadError')));
        xhr.send(file);
      });

      setIsUploading(false);

      // 3. Only after successful PUT, create the verification record
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
        setUploadedMessage(t('submitted'));
      } else {
        // The previous "Thông báo: … Hồ sơ đã được tiếp nhận." default claimed
        // the submission landed even when it did not. A failure now reads as a
        // failure.
        const err = (await submitRes.json().catch(() => ({}))) as { message?: string };
        setUploadError(err.message || t('submitError'));
      }


    } catch (err: unknown) {
      console.error(err);
      // If upload failed, never call POST /student-verifications — we ensure that by sequencing
      const message = err instanceof Error ? err.message : String(err);
      setUploadError(message || t('uploadError'));
      setUploadedMessage(null);
      // do not close immediately so user can see the error
    } finally {
      setIsUploading(false);
      setIsSubmitting(false);
    }
  };

  return <div className="flex min-h-dvh flex-col bg-mist text-ink"><Navbar currentTab="verification" {...(me ? {me} : {})}/><main id="main-content" tabIndex={-1} className="workspace-page flex-1">
    <PageIntro title={t('title')} description={t('description')} art="peer-learning" artAlt={t('artAlt')}/>
    {isLoading ? <p role="status" className="workspace-panel">{t('loading')}</p> : !signedIn ? <StatePanel title={t('signInTitle')} action={<a href={`/${locale}/auth?tab=login&returnUrl=${encodeURIComponent(`/${locale}/verification`)}`} className="workspace-primary">{t('signIn')}</a>}>{t('signInBody')}</StatePanel> : <>
    {loadError && <p role="alert" data-testid="verification-load-error" className="workspace-feedback workspace-feedback-error mb-6">{loadError}</p>}
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="workspace-panel"><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="workspace-panel-title">{t('profile')}</h2><span className={`rounded-full px-3 py-1 text-sm font-semibold ${currentStatus === 'approved' ? 'bg-success-tint text-success-ink' : 'bg-neutral-tint text-ink-soft'}`}>{loadError ? t('status.unknown') : t.has(`status.${currentStatus}`) ? t(`status.${currentStatus}`) : t('status.unknown')}</span></div>
      <dl className="workspace-profile-fields"><div><dt>{t('name')}</dt><dd>{me?.displayName || user?.displayName || '—'}</dd></div><div><dt>{t('email')}</dt><dd>{me?.email || user?.email || '—'}</dd></div><div><dt>{t('school')}</dt><dd>{studentVerif?.schoolName || '—'}</dd></div><div><dt>{t('major')}</dt><dd>{studentVerif?.major || '—'}</dd></div></dl>
      <button className="workspace-secondary mt-5" aria-expanded={isUploadOpen} aria-controls="verification-upload" onClick={()=>setIsUploadOpen(open=>!open)}>{isUploadOpen ? t('close') : t('uploadAction')}</button>
      </section>
      <aside className="workspace-panel"><h2 className="workspace-panel-title">{t('reviewTitle')}</h2><p className="mt-4 text-base leading-relaxed text-ink-soft">{t('reviewBody')}</p><p className="mt-4 text-sm leading-relaxed text-ink-soft">{t('privacy')}</p><a href={`/${locale}#trust`} className="workspace-link mt-4">{t('rules')} ↗</a></aside>
    </div>
    {isUploadOpen && <section id="verification-upload" className="workspace-panel workspace-form mt-6"><h2 className="workspace-panel-title">{t('uploadTitle')}</h2><p className="mt-3 text-base text-ink-soft">{t('uploadBody')}</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><div><label htmlFor="verification-school" className="mb-2 block font-semibold">{t('school')}</label><input id="verification-school" value={schoolName} onChange={e=>setSchoolName(e.target.value)} placeholder={t('schoolPlaceholder')} className="w-full border px-4 py-3" /></div><div><label htmlFor="verification-major" className="mb-2 block font-semibold">{t('major')}</label><input id="verification-major" value={major} onChange={e=>setMajor(e.target.value)} placeholder={t('majorPlaceholder')} className="w-full border px-4 py-3"/></div></div><label htmlFor="verification-document" className="mb-3 mt-6 block font-semibold">{t('document')}</label><input id="verification-document" type="file" accept="image/*,.pdf" disabled={isSubmitting || !schoolName.trim() || !major.trim()} onChange={handleUploadAndSubmit} className="max-w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-campus-emerald-deep file:px-5 file:py-3 file:text-surface disabled:opacity-50"/><p className="mt-3 text-sm text-ink-soft">{t('fileHint')}</p>{isUploading && <p role="status" className="mt-4 text-sm">{t('progress',{progress:uploadProgress})}</p>}{uploadError && <p role="alert" className="workspace-feedback workspace-feedback-error mt-4">{uploadError}</p>}{uploadedMessage && !uploadError && <p role="status" className="workspace-feedback workspace-feedback-success mt-4">{uploadedMessage}</p>}</section>}
    <section className="workspace-panel mt-6"><h2 className="workspace-panel-title">{t('skills')}</h2><p className="mt-3 text-base leading-relaxed text-ink-soft">{t('skillsBody')}</p><p className="mt-4 text-sm">{t('skillCount',{count:skills.filter(skill=>skill.approvedLevel !== null).length})}</p><a href={`/${locale}/skills`} className="workspace-link mt-4">{t('skillsAction')} ↗</a></section>
    </>}
  </main><WorkspaceFooter/></div>;
}
