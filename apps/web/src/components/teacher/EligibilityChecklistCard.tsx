'use client';

import { useTranslations } from 'next-intl';

export function EligibilityChecklistCard() {
  const t = useTranslations('Teacher.publish.checklist');

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h3 className="text-base font-bold text-slate-900">{t('title')}</h3>
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
          {t('badge')}
        </span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
            <span className="font-medium text-slate-800">{t('item1')}</span>
          </div>
          <span className="font-semibold text-emerald-700">{t('item1Status')}</span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
            <span className="font-medium text-slate-800">{t('item2')}</span>
          </div>
          <span className="font-semibold text-emerald-700">{t('item2Status')}</span>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
            <span className="font-medium text-slate-800">{t('item3')}</span>
          </div>
          <span className="font-semibold text-emerald-700">{t('item3Status')}</span>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-[11px] text-slate-600 space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-emerald-900">
          <span className="material-symbols-outlined text-[15px] text-emerald-700">verified</span>
          <span>{t('pledgeTitle')}</span>
        </div>
        <p className="leading-relaxed">
          {t('pledgeDesc')}
        </p>
      </div>
    </section>
  );
}
