'use client';

import { useTranslations } from 'next-intl';

/**
 * Cursor pagination bar (FR-006 / W8 Option A).
 *
 * `GET /classes` is keyset-paginated (`nextCursor`), so the UI exposes a "Load
 * more" button while `nextCursor !== null` rather than numbered pages backed by
 * a single-batch count.
 */
export function PaginationBar({
  count,
  nextCursor,
  loadingMore = false,
  onLoadMore,
}: {
  count: number;
  nextCursor: string | null;
  loadingMore?: boolean;
  onLoadMore: () => void;
}) {
  const t = useTranslations('Marketplace.pagination');

  if (count === 0 && nextCursor === null) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-between gap-4 pt-6 sm:flex-row">
      <span className="text-sm text-ink-soft">
        {t('showing', { from: count === 0 ? 0 : 1, to: count, total: count })}
      </span>
      {nextCursor !== null && (
        <nav aria-label={t('label')} className="flex max-w-full items-center justify-center">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="workspace-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? t('loadingMore') : t('loadMore')}
          </button>
        </nav>
      )}
    </div>
  );
}
