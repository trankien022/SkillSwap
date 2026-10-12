'use client';

import { useTranslations } from 'next-intl';
import type {
  ClassDetailView,
  TeacherCredential,
} from '../../lib/marketplace/types';

/**
 * Teacher dossier (FR-006 detail).
 *
 * Shows the teacher avatar (initial placeholder, no real image), bio,
 * teaching stats (hours taught / response rate / learners helped),
 * and a credentials block. Credentials come from `teacherCredentials` —
 * never from a fabricated score, real name, or named Verifier.
 */
export function TeacherDossierSection({
  item,
}: {
  item: ClassDetailView;
}) {
  const t = useTranslations('ClassDetail.dossier');
  const stats = item.teacherStats;

  return (
    <section
      id="instructor-dossier"
      className="rounded-xl border border-border bg-surface p-6 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mist text-ink">
            <BadgeIcon className="h-5 w-5" />
          </span>
          <h2 className="text-base font-semibold text-ink">{t('title')}</h2>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-success-ink">
          <CheckIcon className="h-4 w-4" />
          <span>{t('locked')}</span>
        </span>
      </div>

      {/* Bio + stats */}
      <div className="mb-6 flex flex-col items-start gap-4 md:flex-row">
        <div className="relative shrink-0">
          <div className="flex h-28 w-28 items-center justify-center rounded-xl bg-ink text-3xl font-semibold text-surface shadow-sm">
            {item.teacherName.charAt(0).toUpperCase()}
          </div>
          <div className="absolute -bottom-2 -right-2 rounded bg-surface px-1.5 py-0.5 text-xs font-bold text-ink shadow-sm">
            {item.level === 'beginner'
              ? 'B1'
              : item.level === 'intermediate'
                ? 'B2'
                : item.level === 'advanced'
                  ? 'C1'
                  : 'C2'}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-ink">
                {item.teacherName}
              </h3>
              <p className="text-sm text-ink-soft">{item.schoolName}</p>
            </div>
            <div className="flex items-center gap-2 text-right">
              <div className="flex flex-col">
                <span className="text-base font-bold text-ink">
                  {t('students', { count: stats.hoursTaught })}
                </span>
                <span className="text-[11px] text-ink-soft">
                  {t('response', { pct: stats.responseRatePct })}
                </span>
              </div>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-ink-soft">
            {item.teacherBio}
          </p>
        </div>
      </div>

      {/* Credentials */}
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
          {t('credentialsHeading')}
        </span>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {item.teacherCredentials.map((cred, idx) => (
            <CredentialRow
              key={idx}
              credential={cred}
              fallbackTitle={
                cred.icon === 'description'
                  ? t('credentialEvidence')
                  : t('credentialBar')
              }
              verifiedLabel={t('verifiedBy')}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CredentialRow({
  credential,
  fallbackTitle,
  verifiedLabel,
}: {
  credential: TeacherCredential;
  fallbackTitle: string;
  verifiedLabel: string;
}) {
  return (
    <article className="flex items-start gap-3 rounded-xl border border-border bg-mist p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-ink shadow-sm">
        <CredentialIcon icon={credential.icon} />
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold text-ink">
          {credential.title || fallbackTitle}
        </span>
        <span className="text-sm text-ink-soft">{credential.body}</span>
        {credential.verifiedBy && (
          <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-success-ink">
            <CheckCircleIcon className="h-3 w-3" />
            <span>
              {verifiedLabel} • {credential.verifiedBy}
            </span>
          </span>
        )}
      </div>
    </article>
  );
}

function CredentialIcon({
  icon,
}: {
  icon: TeacherCredential['icon'];
}) {
  const className = 'h-5 w-5';
  switch (icon) {
    case 'description':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case 'military_tech':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 4h10v5a5 5 0 1 1-10 0z" />
          <path d="M17 4h3v3a3 3 0 0 1-3 3" />
          <path d="M7 4H4v3a3 3 0 0 0 3 3" />
        </svg>
      );
    case 'workspace_premium':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
          <path d="M12 3l2.5 4.5 5 .5-3.5 3.5 1 5L12 14l-5 2.5 1-5L4.5 8l5-.5L12 3z" />
        </svg>
      );
  }
}

function BadgeIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="9" r="6" />
      <path d="M9 14l-2 7 5-3 5 3-2-7" />
    </svg>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CheckCircleIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}