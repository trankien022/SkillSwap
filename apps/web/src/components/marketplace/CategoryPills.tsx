'use client';

import { useTranslations } from 'next-intl';
import { SKILL_CATEGORIES, type SkillCategory } from '../../lib/marketplace/types';

/**
 * Quick-pill row of skill categories (FR-006).
 *
 * The first pill is "Tất cả" (value 'all'). Selecting a pill changes the
 * active category. Categories wrap on phones; selection flows through
 * the parent's query callback.
 */
export function CategoryPills({
  active,
  onChange,
}: {
  active: SkillCategory | 'all';
  onChange: (next: SkillCategory | 'all') => void;
}) {
  const t = useTranslations('Marketplace.categories');

  return (
    <div
      role="radiogroup"
      aria-label={t('label')}
      className="flex flex-wrap items-center gap-x-2 gap-y-1"
    >
      <Pill
        label={t('all')}

        active={active === 'all'}
        onClick={() => onChange('all')}
      />
      {SKILL_CATEGORIES.map((code) => (
        <Pill
          key={code}
          label={t(categoryI18nKey(code))}

          active={active === code}
          onClick={() => onChange(code)}
        />
      ))}
    </div>
  );
}

/** Map the kebab enum value to the camelCase i18n key. */
function categoryI18nKey(
  category: SkillCategory,
): 'language' | 'programming' | 'design' | 'softSkills' | 'math' {
  switch (category) {
    case 'language':
      return 'language';
    case 'programming':
      return 'programming';
    case 'design':
      return 'design';
    case 'soft-skills':
      return 'softSkills';
    case 'math':
      return 'math';
  }
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={
        active
          ? 'flex shrink-0 items-center gap-1 rounded-lg bg-neutral-tint px-3 py-2 text-sm font-semibold text-ink'
          : 'flex shrink-0 items-center gap-1 rounded-lg border border-transparent px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-border hover:bg-mist'
      }
    >
      <span>{label}</span>
    </button>
  );
}
