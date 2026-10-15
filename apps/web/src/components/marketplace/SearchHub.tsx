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
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label
              htmlFor="university-select"
              className="text-sm font-medium leading-5 text-ink-soft"
            >
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
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-sm font-medium leading-5 text-ink-soft">{t('filterButton')}</span>
            <span className="text-base font-medium leading-6 text-ink">{t('filterTitle')}</span>
          </div>
        </button>

        {/* Submit (col-span-2) */}
        <div className="workspace-search-submit">
          <button type="submit" className="workspace-primary w-full">
            <span>{t('submitButton')}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
