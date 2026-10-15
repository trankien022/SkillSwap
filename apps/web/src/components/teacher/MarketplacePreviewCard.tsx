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
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {t('label')}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600"
          />
          {t('live')}
        </span>
      </div>
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-sm">
        <div className="relative flex h-40 w-full items-center justify-center overflow-hidden bg-slate-900">
          <CategoryIcon category={skill?.category ?? null} />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            <span className="rounded-lg bg-white/90 px-2.5 py-0.5 text-xs font-bold text-slate-900 shadow-xs backdrop-blur-md">
              {skill?.label ?? t('categoryFallback')}
            </span>
            {draft.capacity === 1 && (
              <span className="rounded-lg bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white shadow-xs">
                1-1
              </span>
            )}
          </div>
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between text-white">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <CalendarTodayIcon className="h-4 w-4 text-emerald-400" />
              <span>
                {day}/{month}/{year} • {time}
              </span>
            </div>
            <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-bold backdrop-blur-sm">
              {t('minutes', { count: draft.durationMinutes })}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3 bg-white p-4">
          <h4 className="line-clamp-2 text-sm font-bold leading-snug text-slate-900">
            {draft.title.trim() || t('defaultTitle')}
          </h4>
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                GV
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-900">
                  {t('teacher')}
                </span>
                <span className="text-[11px] font-semibold text-emerald-700">
                  {t('verifiedFaculty')}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="block text-[10px] font-semibold text-slate-400 uppercase">
                {t('price')}
              </span>
              <span className="text-base font-extrabold text-slate-900">
                {draft.priceCredits} <span className="text-xs font-bold text-emerald-700">{t('priceUnit')}</span>
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