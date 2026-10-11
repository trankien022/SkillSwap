'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SearchHub } from './SearchHub';
import { CategoryPills } from './CategoryPills';
import { FilterSidebar } from './FilterSidebar';
import { ClassGrid } from './ClassGrid';
import { PaginationBar } from './PaginationBar';
import {
  DEFAULT_QUERY,
  MockMarketplaceGateway,
} from '../../lib/marketplace/mock-gateway';
import type {
  MarketplaceClass,
  MarketplacePage,
  MarketplaceQuery,
  SkillCategory,
  SortOrder,
} from '../../lib/marketplace/types';

const gateway = new MockMarketplaceGateway();

/**
 * Marketplace client shell (FR-006).
 *
 * Owns the live `query` state and a `page` derived from running the
 * gateway. Each child component is given a thin callback and stays
 * presentational. The search submit + category pill click + filter
 * change all flow back here.
 *
 * The 'Dữ liệu minh họa' data badge is rendered by `ClassCard` itself
 * in non-production; this shell only carries layout + state.
 */
export function MarketplaceClient({
  initialPage,
}: {
  initialPage: MarketplacePage;
}) {
  const t = useTranslations('Marketplace.resultsBar');
  const [query, setQuery] = useState<MarketplaceQuery>({
    ...DEFAULT_QUERY,
    page: 1,
  });
  const [page, setPage] = useState<MarketplacePage>(initialPage);
  const [filterOpen, setFilterOpen] = useState<boolean>(true);

  async function runQuery(next: MarketplaceQuery) {
    setQuery(next);
    setPage(await gateway.search(next));
  }

  return (
    <>
      {/* Search + categories */}
      <section className="border-b border-border bg-mist">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
          <div className="mb-6 max-w-3xl">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
              {t('title')}
            </h1>
            <p className="mt-2 text-base text-ink-soft sm:text-lg">
              Find verified student teachers, filter by time and price, and
              book in one tap.
            </p>
          </div>
          <SearchHub
            initialQuery={query}
            filterOpen={filterOpen}
            onToggleFilters={() => setFilterOpen((v) => !v)}
            onSubmit={(next) => runQuery(next)}
          />
          <div className="mt-4">
            <CategoryPills
              active={query.category ?? 'all'}
              onChange={(next) => {
                const category: SkillCategory | 'all' = next;
                runQuery({ ...query, category, page: 1 });
              }}
            />
          </div>
        </div>
      </section>

      {/* Results layout */}
      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {filterOpen && (
            <div className="lg:col-span-3">
              <FilterSidebar
                value={query}
                onChange={(next) => runQuery(next)}
                onReset={() => runQuery({ ...DEFAULT_QUERY, page: 1 })}
              />
            </div>
          )}

          <div className={filterOpen ? 'lg:col-span-9' : 'lg:col-span-12'}>
            <div className="mb-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-ink">
                  {t('title')}
                </span>
                <span className="rounded-full border border-campus-emerald/30 bg-mist px-2 py-0.5 text-xs font-semibold text-campus-emerald">
                  {t('count', { count: page.total })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-soft">{t('sortBy')}</span>
                <select
                  value={query.sort}
                  onChange={(e) =>
                    runQuery({
                      ...query,
                      sort: e.target.value as SortOrder,
                      page: 1,
                    })
                  }
                  className="cursor-pointer rounded-lg border border-border bg-mist px-3 py-1.5 text-sm font-semibold text-ink focus:border-ink focus:outline-none"
                >
                  <option value="nearest">{t('sort.nearest')}</option>
                  <option value="rating">{t('sort.rating')}</option>
                  <option value="price-low">{t('sort.priceLow')}</option>
                  <option value="popular">{t('sort.popular')}</option>
                </select>
              </div>
            </div>

            <ClassGrid items={page.items as MarketplaceClass[]} />
            <PaginationBar
              page={page.page}
              total={page.total}
              perPage={page.perPage}
              onPageChange={(next) => runQuery({ ...query, page: next })}
            />
          </div>
        </div>
      </section>
    </>
  );
}

// UniversityCode is part of the MarketplaceQuery union, so the import is
// kept for downstream consumers (SearchHub reads it).