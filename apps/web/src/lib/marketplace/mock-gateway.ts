import {
  demoMarketplaceClasses,
} from './mock-data';
import { matchesTimeFilter } from './time-filter';
import {
  type MarketplaceClass,
  type MarketplacePage,
  type MarketplaceQuery,
} from './types';

/**
 * In-memory marketplace gateway (FR-006 mock).
 *
 * Mirrors the `MockBookingGateway` pattern: deterministic, no network,
 * runs the same filter/sort pipeline the real HTTP adapter runs.
 */
export class MockMarketplaceGateway {
  private readonly classes: ReadonlyArray<MarketplaceClass>;

  constructor(classes: ReadonlyArray<MarketplaceClass> = demoMarketplaceClasses()) {
    this.classes = classes;
  }

  async search(query: MarketplaceQuery): Promise<MarketplacePage> {
    const filtered = this.classes.filter((item) => matches(item, query));
    const sorted = [...filtered].sort((a, b) => compare(a, b, query.sort));
    const total = sorted.length;

    let start = (query.page - 1) * query.perPage;
    if (query.cursor) {
      const idx = sorted.findIndex((item) => item.id === query.cursor);
      start = idx >= 0 ? idx + 1 : total;
    }

    const items = sorted.slice(start, start + query.perPage);
    const hasMore = start + query.perPage < total;
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    return { items, total, page: query.page, perPage: query.perPage, nextCursor };
  }
}

function matches(item: MarketplaceClass, query: MarketplaceQuery): boolean {
  if (query.keyword) {
    const needle = query.keyword.toLowerCase();
    const haystack = `${item.skillName ?? ''} ${item.teacherName}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  if (query.university && query.university !== 'all') {
    if (item.schoolCode !== query.university) return false;
  }
  if (query.category && query.category !== 'all') {
    if (item.skillCategory !== query.category) return false;
  }
  if (query.formats.length > 0 && !query.formats.includes(item.format)) {
    return false;
  }
  if (query.minRating !== undefined && (item.ratingAvg ?? 0) < query.minRating) {
    return false;
  }
  if (query.priceMin !== undefined && item.priceCredits < query.priceMin) {
    return false;
  }
  if (query.priceMax !== undefined && item.priceCredits > query.priceMax) {
    return false;
  }
  if (query.verifiedOnly === true && item.verified !== true) {
    return false;
  }
  // Shared with the HTTP gateway — see `time-filter.ts` for why this is one function, not two.
  if (!matchesTimeFilter(item.startsAt, query.timeFilter)) {
    return false;
  }
  return true;
}

function compare(
  a: MarketplaceClass,
  b: MarketplaceClass,
  sort: MarketplaceQuery['sort'],
): number {
  if (sort === 'price-low') {
    return a.priceCredits - b.priceCredits;
  }
  if (sort === 'rating') {
    return (b.ratingAvg ?? -1) - (a.ratingAvg ?? -1);
  }
  if (sort === 'popular') {
    return b.ratingCount - a.ratingCount;
  }
  // 'nearest' (default)
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

// Re-export the seeded classes for tests that want to assert on the input.
export { demoMarketplaceClasses } from './mock-data';
