'use client';

import { useTranslations } from 'next-intl';
import { TITLE_MAX_CHARS, type ClassDraft } from '../../lib/teacher/types';

interface Props {
  draft: ClassDraft;
  onChange: (next: Partial<ClassDraft>) => void;
}

/**
 * Section 2: general details (title, description, duration,
 * platform info row).
 *
 * - Title input has a live char counter that flips to error
 *   once the count exceeds 100.
 * - Description is a plain 4-row textarea.
 * - Duration is a 4-button toggle (30 / 45 / 60 / 90).
 * - The platform row is read-only — the spec says online only.
 */
export function GeneralDetailsSection({ draft, onChange }: Props) {
  const t = useTranslations('Teacher.publish.general');
  const tSteps = useTranslations('Teacher.publish.steps');
  const over = draft.title.length > TITLE_MAX_CHARS;
  return (
    <section className="workspace-panel flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-campus-emerald-deep text-sm font-bold text-white shadow-xs">
          2
        </span>
        <h2 className="text-base font-bold text-slate-900">{tSteps('step2Title')}</h2>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="class-title"
          className="flex items-center justify-between text-sm font-semibold text-slate-800"
        >
          <span>{t('titleLabel')}</span>
          <span
            className={
              over
                ? 'text-sm font-semibold text-rose-600'
                : 'text-sm text-slate-400'
            }
          >
            {t('titleCounter', {
              count: draft.title.length,
              max: TITLE_MAX_CHARS,
            })}
          </span>
        </label>
        <input
          id="class-title"
          type="text"
          value={draft.title}
          maxLength={TITLE_MAX_CHARS + 50}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={t('titlePlaceholder')}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-sm font-medium text-slate-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-colors"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="class-desc"
          className="text-sm font-semibold text-slate-800"
        >
          {t('descriptionLabel')}
        </label>
        <textarea
          id="class-desc"
          rows={3}
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder={t('descriptionPlaceholder')}
          className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-sm font-normal text-slate-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-colors"
        />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>
            timeline
          </span>
          <span className="text-sm font-bold text-slate-800">
            {tSteps('syllabusLabel')}
          </span>
        </div>
        {/*
          This block previously listed three fixed roadmap bullets
          ("First 15m: Diagnostic pronunciation…") that were rendered as if they
          were the teacher's own syllabus. Nothing on this form submits them:
          `POST /classes` accepts a single `description` field. Showing invented
          lesson content as the class's roadmap is a fabricated value, so the
          bullets are gone and the hint points back at the description the API
          actually stores.
        */}
        <p className="pt-1 text-sm leading-relaxed text-slate-500">
          {tSteps('syllabusHint')}
        </p>
      </div>
    </section>
  );
}