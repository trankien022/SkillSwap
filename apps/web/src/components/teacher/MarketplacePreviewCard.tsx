'use client';

import { useLocale, useTranslations } from 'next-intl';
import type {
  ClassDraft,
  SkillCategory,
  VerifiedSkill,
} from '../../lib/teacher/types';

interface Props {
  draft: ClassDraft;
  skills: VerifiedSkill[];
}

/**
 * Live marketplace card preview.
 *
 * Mirrors the public class card (ClassCard on the marketplace)
 * but with the teacher's perspective: 'You (Teacher)' label
 * instead of the teacher's name. No CDN image — the cover area
 * uses the campus-emerald surface with the skill category
 * glyph so the preview stays brand-correct and offline-friendly.
 *
 * The card is fully driven by the draft, so every keystroke in
 * the form re-renders this preview in real time.
 */
export function MarketplacePreviewCard({ draft, skills }: Props) {
  const t = useTranslations('Teacher.publish.preview');
  const locale = useLocale();
  const skill = skills.find((s) => s.id === draft.skillId) ?? null;
  const [day, month, year] = draft.startsOn
    ? draft.startsOn.split('-')
    : ['--', '--', '----'];
  const time = draft.startsAt || '--:--';
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
          {t('label')}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-ink">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-ink"
          />
          {t('live')}
        </span>
      </div>
      <article className="overflow-hidden rounded-xl border border-border bg-surface shadow-md transition-shadow hover:shadow-lg">
        <div className="relative flex h-44 w-full items-center justify-center overflow-hidden bg-mist">
          <CategoryIcon category={skill?.category ?? null} />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink/85 via-ink/30 to-transparent" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
            <span className="rounded-md bg-surface/90 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-sm backdrop-blur-md">
              {skill?.label ?? t('categoryFallback')}
            </span>
            {draft.capacity === 1 && (
              <span className="rounded-md bg-success-ink px-2 py-0.5 text-[11px] font-semibold text-surface shadow-sm">
                1-1
              </span>
            )}
          </div>
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between text-surface">
            <div className="flex items-center gap-1 text-[11px]">
              <CalendarTodayIcon className="h-4 w-4 text-success-ink" />
              <span>
                {day}/{month}/{year} • {time}
              </span>
            </div>
            <span className="rounded bg-ink/70 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">
              {t('minutes', { count: draft.durationMinutes })}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 bg-surface p-4">
          <h4 className="line-clamp-2 text-base font-semibold leading-snug text-ink">
            {draft.title.trim() || t('defaultTitle')}
          </h4>
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-surface">
                GV
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-ink">
                  {t('teacher')}
                </span>
                <span className="text-[11px] font-medium text-success-ink">
                  {t('verifiedFaculty')}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="block text-[11px] text-ink-soft">
                {t('price')}
              </span>
              <span className="text-base font-bold text-ink">
                {draft.priceCredits} {t('priceUnit')}
              </span>
            </div>
          </div>
        </div>
      </article>
      {/* Locale intentionally read so the Date(...) format hooks
          (e.g. when we move to Intl.DateTimeFormat) re-render on
          locale switch without a hard reload. */}
      <span className="hidden">{locale}</span>
    </div>
  );
}

function CategoryIcon({ category }: { category: SkillCategory | null }) {
  // A single colour-block with a big SVG glyph — no real images.
  const cn = 'h-16 w-16 text-success-ink';
  const fallback = (
    <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
    </svg>
  );
  switch (category) {
    case 'language':
      return (
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn}>
          <line x1="4" y1="5" x2="14" y2="5" />
          <path d="M4 5l-2 7" />
          <line x1="2" y1="12" x2="12" y2="12" />
          <path d="M14 21l4-10 4 10" />
          <line x1="15.5" y1="18" x2="21" y2="18" />
        </svg>
      );
    case 'code':
      return (
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn}>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case 'design':
      return (
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn}>
          <path d="M3 6h18l-2 12H5z" />
          <path d="M9 6V4a3 3 0 0 1 6 0v2" />
        </svg>
      );
    case 'math':
      return (
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn}>
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      );
    case 'business':
      return (
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn}>
          <path d="M3 21V9l9-6 9 6v12" />
          <path d="M9 21v-8h6v8" />
        </svg>
      );
    case 'science':
      return (
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn}>
          <path d="M9 3h6l-1 7 5 11H5l5-11z" />
        </svg>
      );
    default:
      return fallback;
  }
}

function CalendarTodayIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}