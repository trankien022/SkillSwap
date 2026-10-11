'use client';

import { useTranslations } from 'next-intl';
import type {
  ClassFormat,
  MarketplaceQuery,
  TimeFilter,
} from '../../lib/marketplace/types';

/**
 * Advanced filter sidebar (FR-006).
 *
 * Holds local checkbox/radio/range state and reports changes through
 * `onChange`. The 'Đặt lại' button resets to `DEFAULT_QUERY` (passed in
 * by the parent so the reset semantics stay in one place).
 *
 * The 24-hour minimum lead-time hint is shown as plain copy; we do
 * NOT surface any BR-/AC- IDs to the user.
 */
export function FilterSidebar({
  value,
  onChange,
  onReset,
}: {
  value: MarketplaceQuery;
  onChange: (next: MarketplaceQuery) => void;
  onReset: () => void;
}) {
  const t = useTranslations('Marketplace.filters');

  function toggleFormat(format: ClassFormat) {
    const next = value.formats.includes(format)
      ? value.formats.filter((f) => f !== format)
      : [...value.formats, format];
    onChange({ ...value, formats: next, page: 1 });
  }

  function setTime(filter: TimeFilter) {
    onChange({ ...value, timeFilter: filter, page: 1 });
  }

  function setPriceMax(max: number) {
    onChange({ ...value, priceMax: max, page: 1 });
  }

  function setMinRating(rating: number | undefined) {
    onChange({ ...value, minRating: rating, page: 1 });
  }

  return (
    <aside
      id="filter-sidebar"
      aria-label={t('title')}
      className="sticky top-24 flex flex-col gap-6 rounded-xl border border-border bg-surface p-6 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FilterIcon className="h-5 w-5 text-ink" />
          <h2 className="text-base font-bold text-ink">{t('title')}</h2>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-semibold text-campus-emerald hover:underline"
        >
          {t('reset')}
        </button>
      </div>

      <FilterGroup label={t('format.title')}>
        <Checkbox
          checked={value.formats.includes('one-on-one')}
          onChange={() => toggleFormat('one-on-one')}
          label={t('format.oneOnOne')}
        />
        <Checkbox
          checked={value.formats.includes('group-2-4')}
          onChange={() => toggleFormat('group-2-4')}
          label={t('format.group')}
        />
      </FilterGroup>

      <Divider />

      <FilterGroup label={t('time.title')} hint={t('time.hint')}>
        <Radio
          name="time-filter"
          checked={value.timeFilter === 'all-valid'}
          onChange={() => setTime('all-valid')}
          label={t('time.allValid')}
        />
        <Radio
          name="time-filter"
          checked={value.timeFilter === 'next-24-48h'}
          onChange={() => setTime('next-24-48h')}
          label={t('time.next2448')}
        />
        <Radio
          name="time-filter"
          checked={value.timeFilter === 'this-weekend'}
          onChange={() => setTime('this-weekend')}
          label={t('time.weekend')}
        />
      </FilterGroup>

      <Divider />

      <FilterGroup
        label={t('price.label')}
        rightLabel={t('price.range', {
          min: value.priceMin ?? 30,
          max: value.priceMax ?? 250,
        })}
      >
        <input
          type="range"
          min={30}
          max={250}
          step={5}
          value={value.priceMax ?? 150}
          onChange={(e) => setPriceMax(Number(e.target.value))}
          className="mt-2 w-full cursor-pointer accent-[#0f172a]"
        />
        <div className="mt-1 flex justify-between text-[11px] text-ink-soft">
          <span>30 Cr</span>
          <span>120 Cr</span>
          <span>250+ Cr</span>
        </div>
      </FilterGroup>

      <Divider />

      <FilterGroup label={t('rating.title')}>
        <RatingOption
          active={value.minRating === 4.8}
          onClick={() => setMinRating(value.minRating === 4.8 ? undefined : 4.8)}
          label={t('rating.48plus')}
        />
        <RatingOption
          active={value.minRating === 4.5}
          onClick={() => setMinRating(value.minRating === 4.5 ? undefined : 4.5)}
          label={t('rating.45plus')}
        />
      </FilterGroup>

      <Divider />

      <FilterGroup label={t('verified.title')}>
        <Checkbox
          checked={value.verifiedOnly ?? false}
          onChange={() =>
            onChange({ ...value, verifiedOnly: !value.verifiedOnly, page: 1 })
          }
          label={t('verified.studentVerified')}
          leading={<CheckIcon className="h-4 w-4 text-success-ink" />}
        />
      </FilterGroup>
    </aside>
  );
}

/* --- Internal helpers --- */

function FilterGroup({
  label,
  rightLabel,
  hint,
  children,
}: {
  label: string;
  rightLabel?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">{label}</span>
        {rightLabel && (
          <span className="text-xs font-bold text-campus-emerald">
            {rightLabel}
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-ink-soft">{hint}</p>}
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
  leading,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  leading?: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink-soft hover:text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-[18px] w-[18px] cursor-pointer rounded border-border text-ink accent-ink"
      />
      {leading}
      <span>{label}</span>
    </label>
  );
}

function Radio({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink-soft hover:text-ink">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-[18px] w-[18px] cursor-pointer accent-ink"
      />
      <span>{label}</span>
    </label>
  );
}

function RatingOption({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'flex items-center justify-center gap-1 rounded-lg border border-campus-emerald/30 bg-mist px-3 py-1.5 text-xs font-semibold text-ink'
          : 'flex items-center justify-center gap-1 rounded-lg border border-border bg-mist px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-campus-emerald/30 hover:text-ink'
      }
    >
      <StarIcon className="h-3.5 w-3.5 text-warning-ink" />
      <span>{label}</span>
    </button>
  );
}

function Divider() {
  return <div aria-hidden="true" className="h-px w-full bg-border" />;
}

function FilterIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <line x1="4" y1="6" x2="14" y2="6" />
      <line x1="4" y1="12" x2="10" y2="12" />
      <line x1="4" y1="18" x2="16" y2="18" />
      <circle cx="17" cy="6" r="2" fill="currentColor" />
      <circle cx="13" cy="12" r="2" fill="currentColor" />
      <circle cx="19" cy="18" r="2" fill="currentColor" />
    </svg>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function StarIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" aria-hidden="true" className={className}>
      <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" />
    </svg>
  );
}