'use client';
import { useTranslations } from 'next-intl';
/** Translate known catalogue categories; preserve unfamiliar server content. */
export function SkillCategoryLabel({ category }: { category: string | null | undefined }) {
  const t = useTranslations('Marketplace.categories');
  const keys: Record<string, string> = {
    language: 'language',
    languages: 'language',
    programming: 'programming',
    design: 'design',
    math: 'math',
    mathematics: 'math',
    'soft-skills': 'softSkills',
    'soft skills': 'softSkills',
  };
  const key = keys[(category || '').trim().toLowerCase()];
  return <>{key ? t(key) : category || '—'}</>;
}
