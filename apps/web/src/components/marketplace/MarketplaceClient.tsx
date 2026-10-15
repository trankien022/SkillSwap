'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { SearchHub } from './SearchHub';
import { CategoryPills } from './CategoryPills';
import { FilterSidebar } from './FilterSidebar';
import { ClassGrid } from './ClassGrid';
import { PaginationBar } from './PaginationBar';
import { HttpMarketplaceGateway } from '../../lib/marketplace/http-gateway';
import {
  DEFAULT_QUERY,
  type MarketplaceClass,
  type MarketplacePage,
  type MarketplaceQuery,
  type SkillCategory,
  type SortOrder,
} from '../../lib/marketplace/types';

/** Gateway instance is stateless, so one per module keeps fetch code simple. */
const gateway = new HttpMarketplaceGateway();

type LoadState =
  | { phase: 'loading' }
  | { phase: 'unauth' }
  | { phase: 'error' }
  | { phase: 'ready'; page: MarketplacePage };

/**
 * Marketplace client shell (FR-006).
 *
 * Owns the live `query` state and the fetch lifecycle. `GET /classes` is an
 * authenticated endpoint, so the first page is fetched after mount (the bearer
 * token lives in localStorage) rather than on the server. Each child component
 * is given a thin callback and stays presentational; search submit, category
 * pill click and filter change all flow back here.
 */
export function MarketplaceClient() {
  const t = useTranslations('Marketplace.resultsBar');
  const tStates = useTranslations('Marketplace.states');
  const locale = useLocale();
  const [query, setQuery] = useState<MarketplaceQuery>({
    ...DEFAULT_QUERY,
    page: 1,
  });
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [filterOpen, setFilterOpen] = useState<boolean>(false);

  const runQuery = useCallback(async (next: MarketplaceQuery) => {
    setQuery(next);
    setState({ phase: 'loading' });
    try {
      const page = await gateway.search(next);
      setState({ phase: 'ready', page });
    } catch (error) {
      // A thrown `ApiResponseError` with 401 means no/expired session; anything
      // else is a genuine failure. Both are surfaced honestly, never mocked.
      const status = (error as { status?: number }).status;
      setState({ phase: status === 401 ? 'unauth' : 'error' });
    }
  }, []);

  // First load: fetch the default query once the client has mounted and the
  // stored access token is readable. `runQuery` is stable, so this runs once.
  useEffect(() => {
    void runQuery({ ...DEFAULT_QUERY, page: 1 });
  }, [runQuery]);

  return (
    <>
      {/* Search + categories */}
      <section className="border-b border-border bg-mist">
        <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
          <div className="mb-6 max-w-3xl">
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl">
              {t('title')}
            </h1>
            <p className="mt-2 text-base text-ink-soft sm:text-lg">{t('description')}</p>
          </div>
          <SearchHub
            initialQuery={query}
            filterOpen={filterOpen}
            onToggleFilters={() => setFilterOpen((v) => !v)}
            onSubmit={(next) => void runQuery(next)}
          />
          <div className="mt-4">
            <CategoryPills
              active={query.category ?? 'all'}
              onChange={(next) => {
                const category: SkillCategory | 'all' = next;
                void runQuery({ ...query, category, page: 1 });
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
                onChange={(next) => void runQuery(next)}
                onReset={() => void runQuery({ ...DEFAULT_QUERY, page: 1 })}
              />
            </div>
          )}

          <div className={filterOpen ? 'lg:col-span-9' : 'lg:col-span-12'}>
            <div className="mb-5 flex flex-col items-start justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-ink">{t('title')}</span>
                {state.phase === 'ready' && (
                  <span className="text-sm font-medium text-ink-muted">
                    {t('count', { count: state.page.total })}
                  </span>
                )}
              </div>
              {state.phase === 'ready' && (
                <SortControl
                  query={query}
                  onSort={(sort) => void runQuery({ ...query, sort, page: 1 })}
                  label={t('sortBy')}
                  options={{
                    nearest: t('sort.nearest'),
                    rating: t('sort.rating'),
                    priceLow: t('sort.priceLow'),
                    popular: t('sort.popular'),
                  }}
                />
              )}
            </div>

            {state.phase === 'loading' && <LoadingGrid label={tStates('loading')} />}

            {state.phase === 'unauth' && (
              <StatePanel
                tone="info"
                icon={<LockIcon className="h-5 w-5" />}
                title={tStates('signInTitle')}
                body={tStates('signInBody')}
                cta={{
                  href: `/${locale}/auth?tab=login`,
                  label: tStates('signInCta'),
                }}
              />
            )}

            {state.phase === 'error' && (
              <StatePanel
                tone="error"
                icon={<AlertIcon className="h-5 w-5" />}
                title={tStates('errorTitle')}
                body={tStates('errorBody')}
                cta={{
                  href: `/${locale}/classes`,
                  label: tStates('retry'),
                  onClick: () => void runQuery({ ...query }),
                }}
              />
            )}

            {state.phase === 'ready' && (
              <>
                <ClassGrid items={state.page.items as MarketplaceClass[]} />
                <PaginationBar
                  page={state.page.page}
                  total={state.page.total}
                  perPage={state.page.perPage}
                  onPageChange={(next) => void runQuery({ ...query, page: next })}
                />
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function SortControl({
  query,
  onSort,
  label,
  options,
}: {
  query: MarketplaceQuery;
  onSort: (sort: SortOrder) => void;
  label: string;
  options: { nearest: string; rating: string; priceLow: string; popular: string };
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-ink-soft">{label}</span>
      <select
        value={query.sort}
        onChange={(e) => onSort(e.target.value as SortOrder)}
        className="cursor-pointer rounded-lg border border-border bg-mist px-3 py-1.5 text-sm font-semibold text-ink focus:border-ink focus:outline-none"
      >
        <option value="nearest">{options.nearest}</option>
        <option value="rating">{options.rating}</option>
        <option value="price-low">{options.priceLow}</option>
        <option value="popular">{options.popular}</option>
      </select>
    </div>
  );
}

/** Skeleton cards that mirror `ClassGrid` so the layout does not jump. */
function LoadingGrid({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            aria-hidden="true"
            className="h-72 animate-pulse rounded-2xl border border-border bg-surface shadow-sm"
          />
        ))}
      </div>
    </div>
  );
}

function StatePanel({
  tone,
  icon,
  title,
  body,
  cta,
}: {
  tone: 'info' | 'error';
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: { href: string; label: string; onClick?: () => void };
}) {
  const iconTone =
    tone === 'error' ? 'bg-danger-tint text-danger-ink' : 'bg-neutral-tint text-ink-soft';
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-8 shadow-sm sm:flex-row sm:items-center"
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconTone}`}
      >
        {icon}
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="text-sm text-ink-soft">{body}</p>
      </div>
      <Link
        href={cta.href}
        onClick={cta.onClick}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-ink-soft"
      >
        {cta.label}
      </Link>
    </div>
  );
}

/* --- Inline SVG glyphs --- */

function LockIcon({ className = '' }: { className?: string }) {
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
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function AlertIcon({ className = '' }: { className?: string }) {
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
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="16" x2="12" y2="16.01" />
    </svg>
  );
}
