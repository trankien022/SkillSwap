'use client';

import { useTranslations } from 'next-intl';
import type { ClassDraft, VerifiedSkill } from '../../lib/teacher/types';

interface Props {
  skills: VerifiedSkill[];
  draft: ClassDraft;
  onChange: (next: Partial<ClassDraft>) => void;
}

/**
 * Section 1: skill picker (BR-008 / BR-010).
 *
 * Pure select (no fancy combobox): the verified skills list is
 * short (2 entries in the mock, <= 10 in production) and the
 * template already uses a native <select>. The help callout
 * underneath explains why non-verified skills are not in the
 * dropdown.
 */
export function SkillSelectSection({ skills, draft, onChange }: Props) {
  const t = useTranslations('Teacher.publish.skill');
  const tSteps = useTranslations('Teacher.publish.steps');
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <label
          htmlFor="skill-select"
          className="flex items-center gap-2 text-base font-bold text-slate-900"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-xs">
            1
          </span>
          <span>{tSteps('step1Title')}</span>
        </label>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          <span>{tSteps('step1VerifiedBadge')}</span>
        </span>
      </div>
      <div className="relative">
        <select
          id="skill-select"
          value={draft.skillId}
          onChange={(e) => onChange({ skillId: e.target.value })}
          className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 pr-10 text-sm font-medium text-slate-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-colors"
        >
          {skills.length === 0 ? (
            <option value="">{t('placeholder')}</option>
          ) : (
            skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.label} ({t('verifiedTag')}: {skill.verifierLabel} —{' '}
                {skill.verifierFaculty})
              </option>
            ))
          )}
        </select>
        <ExpandMoreIcon className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
      </div>
      <div className="flex items-start gap-2 rounded-xl bg-slate-50 border border-slate-100 p-3">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p className="text-xs leading-relaxed text-slate-500">
          {t('help')}
        </p>
      </div>
    </section>
  );
}


function CheckCircleIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function ExpandMoreIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function InfoIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <circle cx="12" cy="8" r="0.6" fill="currentColor" />
    </svg>
  );
}