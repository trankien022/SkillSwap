'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { PageIntro } from '../ui/PageIntro';
import { StatePanel as WorkspaceState } from '../ui/StatePanel';
import { SearchHub } from './SearchHub';
import { CategoryPills } from './CategoryPills';
import { FilterSidebar } from './FilterSidebar';
import { ClassGrid } from './ClassGrid';
import { PaginationBar } from './PaginationBar';
import { HttpMarketplaceGateway } from '../../lib/marketplace/http-gateway';
import {
  DEFAULT_QUERY,
  type MarketplaceClass,
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
  | {
      phase: 'ready';
      items: MarketplaceClass[];
      nextCursor: string | null;
      loadingMore: boolean;
    };

/**
 * Marketplace client shell (FR-006 / W8).
 *
 * Owns the live `query` state and cursor-based pagination lifecycle. Any filter,
 * category, keyword, or sort change resets the cursor and starts a fresh first
 * page; clicking "Load more" requests the next cursor page and appends its items.
 */
export function MarketplaceClient({ initialCategory }: { initialCategory?: SkillCategory }) {
  const t = useTranslations('Marketplace.resultsBar');
  const tStates = useTranslations('Marketplace.states');
  const locale = useLocale();
  const [query, setQuery] = useState<MarketplaceQuery>({
    ...DEFAULT_QUERY,
    category: initialCategory,
    page: 1,
  });
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [filterOpen, setFilterOpen] = useState<boolean>(false);

  const runQuery = useCallback(async (next: MarketplaceQuery) => {
    const cleanQuery: MarketplaceQuery = { ...next, page: 1, cursor: undefined };
    setQuery(cleanQuery);
    setState({ phase: 'loading' });
    try {
      const page = await gateway.search(cleanQuery);
      setState({
        phase: 'ready',
        items: page.items,
        nextCursor: page.nextCursor,
        loadingMore: false,
      });
    } catch (error) {
      const status = (error as { status?: number }).status;
      setState({ phase: status === 401 ? 'unauth' : 'error' });
    }
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (state.phase !== 'ready' || state.nextCursor === null || state.loadingMore) {
      return;
    }
    const cursor = state.nextCursor;
    setState({ ...state, loadingMore: true });
    try {
      const nextPage = await gateway.search({ ...query, cursor });
      setState((prev) => {
        if (prev.phase !== 'ready') return prev;
        const seen = new Set(prev.items.map((item) => item.id));
        const merged = [...prev.items];
        for (const item of nextPage.items) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            merged.push(item);
          }
        }
        return {
          phase: 'ready',
          items: merged,
          nextCursor: nextPage.nextCursor,
          loadingMore: false,
        };
      });
    } catch (error) {
      const status = (error as { status?: number }).status;
      setState({ phase: status === 401 ? 'unauth' : 'error' });
    }
  }, [query, state]);

  useEffect(() => {
    void runQuery({ ...DEFAULT_QUERY, category: initialCategory, page: 1 });
  }, [runQuery, initialCategory]);

  return (
    <>
      {/* Search + categories */}
      <section className="bg-mist">
        <div className="workspace-page">
          <PageIntro
            title={t('title')}
            description={t('description')}
            art="programming"
            artAlt={t('artAlt')}
          />
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
      <section className="workspace-page">
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
            <div className="mb-5 flex flex-col items-start justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-ink">{t('title')}</span>
                {state.phase === 'ready' && (
                  <span className="text-sm font-medium text-ink-muted">
                    {t('count', { count: state.items.length })}
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

            {state.phase === 'ready' &&
              (state.items.length === 0 ? (
                <WorkspaceState title={tStates('emptyTitle')} tone="neutral">
                  {t('description')}
                </WorkspaceState>
              ) : (
                <>
                  <ClassGrid items={state.items} />
                  <PaginationBar
                    count={state.items.length}
                    nextCursor={state.nextCursor}
                    loadingMore={state.loadingMore}
                    onLoadMore={() => void handleLoadMore()}
                  />
                </>
              ))}
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
        aria-label={label}
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
            className="h-72 animate-pulse rounded-2xl border border-border bg-surface "
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
  void icon;
  return (
    <WorkspaceState
      title={title}
      tone={tone === 'error' ? 'error' : 'neutral'}
      action={
        cta.onClick ? (
          <button type="button" onClick={cta.onClick} className="workspace-primary">
            {cta.label}
          </button>
        ) : (
          <Link href={cta.href} className="workspace-primary">
            {cta.label}
          </Link>
        )
      }
    >
      {body}
    </WorkspaceState>
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
