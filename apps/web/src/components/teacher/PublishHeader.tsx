import { getTranslations } from 'next-intl/server';

/**
 * Header above the left-column form: step indicator + h1 + the
 * 'subject module' chip. Server component.
 */
export async function PublishHeader() {
  const t = await getTranslations('Teacher.publish');
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
          {t('step')}
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
          {t('title')}
        </h1>
      </div>
      <span className="rounded-lg bg-mist px-3 py-1 text-xs font-semibold text-ink">
        {t('subjectChip')}
      </span>
    </div>
  );
}