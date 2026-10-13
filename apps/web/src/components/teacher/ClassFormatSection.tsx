'use client';

import { useTranslations } from 'next-intl';
import { MAX_CAPACITY, type ClassDraft } from '../../lib/teacher/types';

interface Props {
  draft: ClassDraft;
  onChange: (next: Partial<ClassDraft>) => void;
}

/**
 * Step 3: Class Format & Scale (1-on-1 vs Small Group).
 */
export function ClassFormatSection({ draft, onChange }: Props) {
  const tSteps = useTranslations('Teacher.publish.steps');
  const tSched = useTranslations('Teacher.publish.schedule');
  const isOneOnOne = draft.capacity === 1;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-xs">
          3
        </span>
        <h2 className="text-base font-bold text-slate-900">{tSteps('step3Title')}</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* 1-on-1 Option Card */}
        <button
          type="button"
          onClick={() => onChange({ capacity: 1 })}
          className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
            isOneOnOne
              ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600 shadow-xs'
              : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">
                {tSteps('format1to1Title')}
              </span>
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                  isOneOnOne
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {isOneOnOne && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              {tSteps('format1to1Desc')}
            </p>
          </div>
        </button>

        {/* Small Group Option Card */}
        <button
          type="button"
          onClick={() => onChange({ capacity: draft.capacity > 1 ? draft.capacity : 4 })}
          className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
            !isOneOnOne
              ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600 shadow-xs'
              : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">
                {tSteps('formatGroupTitle')}
              </span>
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                  !isOneOnOne
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {!isOneOnOne && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              {tSteps('formatGroupDesc')}
            </p>
          </div>
          <div className="pt-3">
            <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
              {tSteps('formatGroupSave')}
            </span>
          </div>
        </button>
      </div>

      {/* Stepper only when group is selected */}
      {!isOneOnOne && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <div>
            <span className="block text-xs font-bold text-slate-800">
              {tSched('capacityLabel')}
            </span>
            <span className="block text-[11px] font-medium text-emerald-700">
              {tSched('capacityBadgeGroup', { count: draft.capacity })}
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-xs">
            <button
              type="button"
              aria-label="decrement capacity"
              disabled={draft.capacity <= 2}
              onClick={() => onChange({ capacity: Math.max(2, draft.capacity - 1) })}
              className="flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-bold text-slate-900">
              {draft.capacity}
            </span>
            <button
              type="button"
              aria-label="increment capacity"
              disabled={draft.capacity >= MAX_CAPACITY}
              onClick={() => onChange({ capacity: Math.min(MAX_CAPACITY, draft.capacity + 1) })}
              className="flex h-7 w-7 items-center justify-center rounded text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
