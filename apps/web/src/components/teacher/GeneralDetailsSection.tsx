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
  const tStep = useTranslations('Teacher.publish');
  const over = draft.title.length > TITLE_MAX_CHARS;
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="class-title"
          className="flex items-center justify-between text-base font-semibold text-ink"
        >
          <span>{t('titleLabel')}</span>
          <span
            className={
              over
                ? 'text-[11px] font-semibold text-error'
                : 'text-[11px] text-ink-soft'
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
          className="w-full rounded-lg border border-border bg-mist px-4 py-2.5 text-base text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-ink"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="class-desc"
          className="text-base font-semibold text-ink"
        >
          {t('descriptionLabel')}
        </label>
        <textarea
          id="class-desc"
          rows={4}
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder={t('descriptionPlaceholder')}
          className="w-full resize-y rounded-lg border border-border bg-mist px-4 py-2.5 text-base text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-ink"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-ink">
            {t('durationLabel')}
          </span>
          <span className="text-[11px] text-ink-soft">
            {t('durationStandard')}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[30, 45, 60, 90].map((d) => {
            const active = draft.durationMinutes === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() =>
                  onChange({ durationMinutes: d as ClassDraft['durationMinutes'] })
                }
                className={
                  active
                    ? 'rounded-lg border border-ink bg-ink px-3 py-2 text-sm font-semibold text-surface shadow-sm'
                    : 'rounded-lg border border-border bg-mist px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface'
                }
              >
                {tStep('stepDuration', { count: d })}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border bg-mist p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-ink shadow-sm">
            <VideocamIcon className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-sm font-bold text-ink">
              {t('platform.name')}
            </span>
            <span className="block text-[11px] text-ink-soft">
              {t('platform.caption')}
            </span>
          </div>
        </div>
        <span className="rounded-full bg-success-tint px-2.5 py-1 text-[11px] font-semibold text-success-ink">
          {t('platform.onlineOnly')}
        </span>
      </div>
    </section>
  );
}

function VideocamIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10l6-3v10l-6-3z" />
    </svg>
  );
}