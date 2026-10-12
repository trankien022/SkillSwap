import {
  demoMarketplaceClasses,
} from './mock-data';
import {
  type MarketplaceClass,
  type MarketplacePage,
  type MarketplaceQuery,
} from './types';

/**
 * In-memory marketplace gateway (FR-006 mock).
 *
 * Mirrors the `MockBookingGateway` pattern: deterministic, no network,
 * runs the same filter/sort pipeline the real HTTP adapter will run so
 * the UI can be built and tested today. The `classSchema` from
 * `@skillswap/contracts` is the wire contract, so a future
 * `HttpMarketplaceGateway` can be dropped in without UI changes.
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
    const start = (query.page - 1) * query.perPage;
    const items = sorted.slice(start, start + query.perPage);
    return { items, total, page: query.page, perPage: query.perPage };
  }
}

function matches(item: MarketplaceClass, query: MarketplaceQuery): boolean {
  if (query.keyword) {
    const needle = query.keyword.toLowerCase();
    const haystack = `${item.skillName} ${item.teacherName}`.toLowerCase();
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
  if (query.minRating !== undefined && item.ratingAvg < query.minRating) {
    return false;
  }
  if (query.priceMin !== undefined && item.priceCredits < query.priceMin) {
    return false;
  }
  if (query.priceMax !== undefined && item.priceCredits > query.priceMax) {
    return false;
  }
  if (query.verifiedOnly === true && !item.verified) {
    return false;
  }
  if (!matchesTimeFilter(item, query.timeFilter)) {
    return false;
  }
  return true;
}

const HOUR = 60 * 60 * 1000;

function matchesTimeFilter(
  item: MarketplaceClass,
  filter: MarketplaceQuery['timeFilter'],
): boolean {
  const hoursAhead =
    (new Date(item.startsAt).getTime() - Date.now()) / HOUR;
  if (filter === 'all-valid') {
    // BR-021: bookings close 24h before class; only show classes still bookable.
    return hoursAhead > 24;
  }
  if (filter === 'next-24-48h') {
    return hoursAhead > 24 && hoursAhead <= 48;
  }
  // 'this-weekend' (Sat/Sun within current week, > 24h)
  if (filter === 'this-weekend') {
    if (hoursAhead <= 24) return false;
    const day = new Date(item.startsAt).getDay();
    return day === 0 || day === 6;
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
    return b.ratingAvg - a.ratingAvg;
  }
  if (sort === 'popular') {
    return b.ratingCount - a.ratingCount;
  }
  // 'nearest' (default)
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

/** Default query moved to `./types` — it is not mock behaviour. `mock-gateway`
 * imports it from there for its own tests. */

// Re-export the seeded classes for tests that want to assert on the input.
export { demoMarketplaceClasses } from './mock-data';
