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
      aria-label={t('all')}
      className="flex flex-wrap items-center gap-x-2 gap-y-1"
    >
      <span className="mr-1 shrink-0 text-sm font-semibold r text-ink-soft">
        {/* caption for the pills row */}
        <span className="sr-only">Categories</span>
      </span>
      <Pill
        label={t('all')}
        icon={<AppsIcon className="h-3.5 w-3.5" />}
        active={active === 'all'}
        onClick={() => onChange('all')}
      />
      {SKILL_CATEGORIES.map((code) => (
        <Pill
          key={code}
          label={t(categoryI18nKey(code))}
          icon={<CategoryIcon category={code} />}
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

function Pill({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
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
      <span className="text-current">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function CategoryIcon({ category }: { category: SkillCategory }) {
  switch (category) {
    case 'language':
      return <TranslateIcon className="h-3.5 w-3.5" />;
    case 'programming':
      return <TerminalIcon className="h-3.5 w-3.5" />;
    case 'design':
      return <PaletteIcon className="h-3.5 w-3.5" />;
    case 'soft-skills':
      return <PsychologyIcon className="h-3.5 w-3.5" />;
    case 'math':
      return <CalculateIcon className="h-3.5 w-3.5" />;
    default:
      return null;
  }
}

function AppsIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function TranslateIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 5h8M4 5l-2 7M4 5l2 7" />
      <path d="M2 12h10" />
      <path d="M14 21l4-10 4 10" />
      <path d="M15.5 18h5" />
    </svg>
  );
}

function TerminalIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9l3 3-3 3M13 15h4" />
    </svg>
  );
}

function PaletteIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 3a9 9 0 1 0 0 18c1 0 2-1 2-2v-1a2 2 0 0 1 2-2h2a4 4 0 0 0 4-4 9 9 0 0 0-10-9z" />
      <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="9.5" cy="6.5" r="1" fill="currentColor" />
      <circle cx="14.5" cy="6.5" r="1" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r="1" fill="currentColor" />
    </svg>
  );
}

function PsychologyIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M9 4a4 4 0 0 0-4 4v2a3 3 0 0 0-2 3 3 3 0 0 0 2 3 4 4 0 0 0 4 4h1v-2" />
      <path d="M15 4a4 4 0 0 1 4 4v2a3 3 0 0 1 2 3 3 3 0 0 1-2 3 4 4 0 0 1-4 4h-1v-2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

function CalculateIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15h0M8 19h2M12 19h2M16 19h0" />
    </svg>
  );
}
