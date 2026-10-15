'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { MarketplaceQuery, UniversityCode } from '../../lib/marketplace/types';
import { UNIVERSITY_CODES } from '../../lib/marketplace/types';

/** Search fields and the optional filter trigger share the parent query. */
export function SearchHub({
  initialQuery,
  onSubmit,
  onToggleFilters,
  filterOpen,
}: {
  initialQuery: MarketplaceQuery;
  onSubmit: (next: MarketplaceQuery) => void;
  onToggleFilters: () => void;
  filterOpen: boolean;
}) {
  const t = useTranslations('Marketplace.search');
  const [keyword, setKeyword] = useState<string>(initialQuery.keyword ?? '');
  const [university, setUniversity] = useState<UniversityCode | 'all'>(
    initialQuery.university ?? 'all',
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      ...initialQuery,
      keyword: keyword.trim() === '' ? undefined : keyword.trim(),
      university,
    });
  }

  return (
    <div className="w-full rounded-2xl border border-border bg-surface p-3 ">
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 items-center gap-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto_auto]"
        role="search"
        aria-label={t('keywordLabel')}
      >
        {/* Keyword input (col-span-5) */}
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-mist ">
          <SearchIcon className="h-5 w-5 shrink-0 text-ink" />
          <div className="flex w-full min-w-0 flex-col">
            <label htmlFor="search-keyword" className="text-sm font-medium text-ink-soft">
              {t('keywordLabel')}
            </label>
            <input
              id="search-keyword"
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('keywordPlaceholder')}
              className="w-full bg-transparent text-sm font-semibold text-ink placeholder:text-ink-muted focus:outline-none"
            />
          </div>
        </div>

        {/* University select (col-span-3) */}
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-mist ">
          <SchoolIcon className="h-5 w-5 shrink-0 text-ink-soft" />
          <div className="flex w-full min-w-0 flex-col">
            <label htmlFor="university-select" className="text-sm font-medium text-ink-soft">
              {t('universityLabel')}
            </label>
            <select
              id="university-select"
              value={university}
              onChange={(e) => setUniversity(e.target.value as UniversityCode | 'all')}
              className="w-full cursor-pointer truncate bg-transparent text-sm font-semibold text-ink focus:outline-none"
            >
              <option value="all">{t('universityAll')}</option>
              {UNIVERSITY_CODES.map((code) => (
                <option key={code} value={code}>
                  {t(`universities.${code}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bộ lọc phụ trigger (col-span-2) */}
        <button
          type="button"
          onClick={onToggleFilters}
          aria-expanded={filterOpen}
          aria-controls="filter-sidebar"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-mist "
        >
          <TuneIcon className="h-5 w-5 shrink-0 text-ink-soft" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-ink-soft">{t('filterButton')}</span>
            <span className="text-sm font-semibold text-ink">{t('filterTitle')}</span>
          </div>
        </button>

        {/* Submit (col-span-2) */}
        <div className="flex justify-end ">
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-campus-emerald-deep px-5 text-sm font-semibold text-surface  transition-colors hover:bg-campus-emerald-deep"
          >
            <TravelExploreIcon className="h-4 w-4" />
            <span>{t('submitButton')}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/* --- Internal helpers --- */

function SearchIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function SchoolIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 9l9-5 9 5-9 5-9-5z" />
      <path d="M7 11v5c2 1.5 4 1.5 5 1.5s3 0 5-1.5v-5" />
    </svg>
  );
}

function TuneIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="10" cy="6" r="2" fill="currentColor" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="16" cy="12" r="2" fill="currentColor" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="8" cy="18" r="2" fill="currentColor" />
    </svg>
  );
}

function TravelExploreIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M16 8l-2 6-6 2 2-6 6-2z" />
    </svg>
  );
}
