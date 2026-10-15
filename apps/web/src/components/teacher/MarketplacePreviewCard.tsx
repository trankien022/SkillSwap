'use client';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ClassDraft, VerifiedSkill } from '../../lib/teacher/types';

/** Preview of the current draft, never an assertion that it is published. */
export function MarketplacePreviewCard({
  draft,
  skills,
}: {
  draft: ClassDraft;
  skills: VerifiedSkill[];
}) {
  const t = useTranslations('Teacher.publish.preview');
  const skill = skills.find((item) => item.id === draft.skillId);
  return (
    <section className="workspace-panel space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="workspace-panel-title">{t('label')}</h3>
        <span className="rounded-full bg-neutral-tint px-3 py-1 text-sm text-ink-soft">
          {t('draft')}
        </span>
      </div>
      <Image
        src="/learning/design.webp"
        alt=""
        width={800}
        height={533}
        sizes="(max-width: 1023px) 100vw, 400px"
        className="h-36 w-full rounded-xl object-cover"
      />
      <p className="text-sm text-ink-soft">{skill?.label || t('categoryFallback')}</p>
      <h4 className="text-xl font-semibold tracking-tight">
        {draft.title.trim() || t('defaultTitle')}
      </h4>
      <p className="text-sm text-ink-soft">
        {draft.startsOn || '—'} · {draft.startsAt || '—'} ·{' '}
        {t('minutes', { count: draft.durationMinutes })}
      </p>
      <div className="flex flex-wrap items-baseline justify-between gap-3 rounded-xl bg-mist p-4">
        <span className="text-sm text-ink-soft">{t('price')}</span>
        <strong className="text-xl">
          {draft.priceCredits} <span className="text-sm font-medium">{t('priceUnit')}</span>
        </strong>
      </div>
    </section>
  );
}
