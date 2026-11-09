import type { ClassListItemView } from '@skillswap/contracts';

export interface MarketplaceFilterState {
  format: 'all' | 'one-on-one' | 'group';
  verified: 'all' | 'yes' | 'no';
  maxPrice: string;
  minRating: string;
}

export function filterMarketplaceItems(items: readonly ClassListItemView[], filters: MarketplaceFilterState) {
  const maxPrice = filters.maxPrice.trim() ? Number(filters.maxPrice) : null;
  const minRating = filters.minRating.trim() ? Number(filters.minRating) : null;
  return items.filter((item) =>
    (filters.format === 'all' || item.format === filters.format) &&
    (filters.verified === 'all' || item.verified === (filters.verified === 'yes')) &&
    (maxPrice === null || (Number.isFinite(maxPrice) && item.priceCredits <= maxPrice)) &&
    (minRating === null || (Number.isFinite(minRating) && item.averageRating !== null && item.averageRating >= minRating)),
  );
}
