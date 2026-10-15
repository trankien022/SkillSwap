'use client';

import { useTranslations } from 'next-intl';
import type { ClassDraft } from '../../lib/teacher/types';

interface Props {
  draft: ClassDraft;
  onChange: (next: Partial<ClassDraft>) => void;
}

/**
 * Step 4: Schedule, duration, and automatic virtual classroom setup.
 */
export function ScheduleDurationSection({ draft, onChange }: Props) {
  const t = useTranslations('Teacher.publish.schedule');
  const tGeneral = useTranslations('Teacher.publish.general');
  const tSteps = useTranslations('Teacher.publish.steps');
  const tRoot = useTranslations('Teacher.publish');

  return (
    <section className="workspace-panel flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-campus-emerald-deep text-sm font-bold text-white shadow-xs">
            4
          </span>
          <h2 className="text-base font-bold text-slate-900">{tSteps('step4Title')}</h2>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold text-emerald-800 border border-emerald-200">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          <span>{tSteps('leadTimeValid')}</span>
        </span>
      </div>

      {/* Date & Time Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="class-date" className="text-sm font-semibold text-slate-800">
              {t('dateLabel')}
            </label>
            <span className="text-sm font-medium text-ink-muted">{tSteps('leadTimeBadge')}</span>
          </div>
          <input
            id="class-date"
            type="date"
            value={draft.startsOn}
            onChange={(e) => onChange({ startsOn: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-sm font-medium text-slate-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="class-time" className="text-sm font-semibold text-slate-800">
            {t('timeLabel')}
          </label>
          <input
            id="class-time"
            type="time"
            value={draft.startsAt}
            onChange={(e) => onChange({ startsAt: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5 text-sm font-medium text-slate-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Duration selector */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800">{tGeneral('durationLabel')}</span>
          <span className="text-sm text-ink-muted">{tGeneral('durationStandard')}</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[30, 45, 60, 90].map((d) => {
            const active = draft.durationMinutes === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onChange({ durationMinutes: d as ClassDraft['durationMinutes'] })}
                className={
                  active
                    ? 'rounded-xl border border-emerald-600 bg-campus-emerald-deep px-3 py-2 text-sm font-bold text-white shadow-xs'
                    : 'rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:border-slate-300'
                }
              >
                {tRoot('stepDuration', { count: d })}
              </button>
            );
          })}
        </div>
      </div>

      {/* Virtual Classroom Integration */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-emerald-700 shadow-xs border border-slate-200">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">
              videocam
            </span>
          </div>
          <div>
            <span className="block text-sm font-bold text-slate-900">{tSteps('autoRoom')}</span>
            <span className="block text-sm text-slate-500">{tSteps('autoRoomDesc')}</span>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-bold text-emerald-800 border border-emerald-200">
          {tSteps('autoRoomPill')}
        </span>
      </div>
    </section>
  );
}

function CheckCircleIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}
