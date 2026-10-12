import { getTranslations } from 'next-intl/server';

/**
 * Header above the publish class workspace (FR-022).
 */
export async function PublishHeader() {
  const t = await getTranslations('Teacher.publish');
  return (
    <div className="flex flex-col gap-2 border-b border-slate-200 pb-5">
      <div className="inline-flex items-center gap-1.5 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
        <span className="material-symbols-outlined text-[16px] text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>
          verified_user
        </span>
        <span>{t('step')}</span>
        <span className="text-slate-300 mx-1">•</span>
        <span className="font-normal text-slate-600">{t('verifiedChip')}</span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          {t('title')}
        </h1>
        <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 self-start sm:self-auto">
          {t('subjectChip')}
        </span>
      </div>
    </div>
  );
}