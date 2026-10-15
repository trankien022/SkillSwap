'use client';

import { useEffect, useState } from 'react';
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

  // Reflect reset/filter changes made by the parent in the visible controls.
  useEffect(() => {
    setKeyword(initialQuery.keyword ?? '');
    setUniversity(initialQuery.university ?? 'all');
  }, [initialQuery.keyword, initialQuery.university]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      ...initialQuery,
      keyword: keyword.trim() === '' ? undefined : keyword.trim(),
      university,
      page: 1,
    });
  }

  return (
    <div className="workspace-search-hub">
      <form
        onSubmit={handleSubmit}
        className="workspace-search-grid"
        role="search"
        aria-label={t('keywordLabel')}
      >
        {/* Keyword input (col-span-5) */}
        <div className="workspace-search-field">
          <SearchIcon className="h-5 w-5 shrink-0 text-ink" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor="search-keyword" className="text-sm font-medium leading-5 text-ink-soft">
              {t('keywordLabel')}
            </label>
            <input
              id="search-keyword"
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t('keywordPlaceholder')}
              className="workspace-search-input"
            />
          </div>
        </div>

        {/* University select (col-span-3) */}
        <div className="workspace-search-field">
          <SchoolIcon className="h-5 w-5 shrink-0 text-ink-soft" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor="university-select" className="text-sm font-medium leading-5 text-ink-soft">
              {t('universityLabel')}
            </label>
            <select
              id="university-select"
              value={university}
              onChange={(e) => setUniversity(e.target.value as UniversityCode | 'all')}
              className="workspace-search-input"
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
          className="workspace-search-field workspace-search-filter"
        >
          <TuneIcon className="h-5 w-5 shrink-0 text-ink-soft" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium leading-5 text-ink-soft">{t('filterButton')}</span>
            <span className="text-base font-medium leading-6 text-ink">{t('filterTitle')}</span>
          </div>
        </button>

        {/* Submit (col-span-2) */}
        <div className="workspace-search-submit">
          <button
            type="submit"
            className="workspace-primary w-full"
          >
            <SearchIcon className="h-5 w-5" />
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
