'use client';

import { useTranslations } from 'next-intl';

/**
 * Pagination bar (FR-006). The actual page is held by the parent
 * `MarketplaceClient`; this component just renders the controls and
 * calls back on changes.
 */
export function PaginationBar({
  page,
  total,
  perPage,
  onPageChange,
}: {
  page: number;
  total: number;
  perPage: number;
  onPageChange: (next: number) => void;
}) {
  const t = useTranslations('Marketplace.pagination');
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const pages: Array<number | 'gap'> = [];
  for (let i = 1; i <= lastPage; i++) {
    if (i === 1 || i === lastPage || Math.abs(i - page) <= 1) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== 'gap') {
      pages.push('gap');
    }
  }

  return (
    <div className="flex flex-col items-center justify-between gap-4 pt-6 sm:flex-row">
      <span className="text-sm text-ink-soft">
        {t('showing', { from, to, total })}
      </span>
      <nav
        aria-label={t('label')}
        className="flex max-w-full flex-wrap items-center justify-center gap-1 rounded-xl border border-border bg-surface p-1"
      >
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label={t('prev')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-mist hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        {pages.map((entry, idx) =>
          entry === 'gap' ? (
            <span
              key={`gap-${idx}`}
              className="w-6 text-center text-sm text-ink-muted"
            >
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? 'page' : undefined}
              className={
                entry === page
                  ? 'h-9 w-9 rounded-lg bg-ink text-sm font-semibold text-surface '
                  : 'h-9 w-9 rounded-lg text-sm font-semibold text-ink-soft transition-colors hover:bg-mist hover:text-ink'
              }
            >
              {entry}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(lastPage, page + 1))}
          disabled={page >= lastPage}
          aria-label={t('next')}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-mist hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}

function ChevronLeftIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}