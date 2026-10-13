'use client';

import { useTranslations } from 'next-intl';
import type {
  ClassDetailView,
  SyllabusStep,
} from '../../lib/marketplace/types';

/**
 * Syllabus / goals section (FR-006 detail).
 *
 * Renders the class description, then an ordered timeline of session
 * steps. Each step shows a numbered circle, a title, a minutes badge,
 * and a body paragraph. The target-band caption is generic.
 */
export function SyllabusSection({ item }: { item: ClassDetailView }) {
  const t = useTranslations('ClassDetail.syllabus');

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mist text-ink">
            <MenuBookIcon className="h-5 w-5" />
          </span>
          <h2 className="text-base font-semibold text-ink">{t('title')}</h2>
        </div>
        <span className="text-xs text-ink-soft">{t('target')}</span>
      </div>

      <p className="mb-6 text-sm leading-relaxed text-ink-soft">
        {item.description}
      </p>

      <ol className="flex flex-col gap-4">
        {item.syllabus.map((step) => (
          <li key={step.order}>
            <SyllabusStepRow step={step} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function SyllabusStepRow({ step }: { step: SyllabusStep }) {
  const t = useTranslations('ClassDetail.syllabus');
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-mist p-4 transition-colors hover:bg-neutral-tint">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-surface">
        {String(step.order).padStart(2, '0')}
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-ink">
            {t('stepN', { n: step.order })}
          </span>
          <span className="text-xs text-ink-soft">
            {t('minutes', { n: step.minutes })}
          </span>
        </div>
        <p className="text-sm text-ink-soft">{step.body}</p>
      </div>
    </div>
  );
}

function MenuBookIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" />
      <path d="M20 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z" />
    </svg>
  );
}