import {
  listClassesPageSchema,
  skillCataloguePageSchema,
  type ClassListItemView,
} from '@skillswap/contracts';
import { callApi, unwrapEnvelope } from '../api-client';
import {
  toMarketplaceClass,
  type SkillCatalogue,
} from './api-mapping';
import { DEFAULT_QUERY } from './types';
import type { MarketplaceClass, MarketplacePage, MarketplaceQuery } from './types';

/**
 * Live marketplace gateway (FR-006) — reads classes and the skill catalogue
 * from the real API, mirroring `apps/mobile/.../class-read-gateway.ts`.
 *
 * The backend endpoint is authenticated, so every call goes through `callApi`,
 * which attaches the bearer token and refreshes it once on 401.
 *
 * Endpoints:
 * - GET /classes  — keyset-paginated class list (keyword, skillId, date range, state)
 * - GET /skills   — standardized catalogue, needed to resolve skill names
 *
 * The API only understands `keyword`/`skillId`/dates/state, so the remaining
 * sidebar filters (university, format, rating, price, time window) are applied
 * over the fetched page here. They are client-side refinements of real data,
 * never substitutes for it.
 */
export class HttpMarketplaceGateway {
  constructor(private readonly limit = 20) {}

  /** Fetches the catalogue once per call; callers may reuse it via `search`. */
  async getCatalogue(): Promise<SkillCatalogue> {
    const res = await callApi('/skills?limit=100');
    const page = skillCataloguePageSchema.parse(await unwrapEnvelope<unknown>(res));
    return new Map(page.items.map((item) => [item.id, item]));
  }

  async search(query: MarketplaceQuery): Promise<MarketplacePage> {
    const catalogue = await this.getCatalogue();
    const classes = await this.fetchClasses(query);
    const mapped = classes.map((item) => toMarketplaceClass(item, catalogue));
    const filtered = applyClientFilters(mapped, query);
    const sorted = applySort(filtered, query);
    return {
      items: sorted,
      total: sorted.length,
      page: query.page,
      perPage: query.perPage,
    };
  }

  private async fetchClasses(query: MarketplaceQuery): Promise<readonly ClassListItemView[]> {
    const params = new URLSearchParams();
    if (query.keyword && query.keyword.trim().length > 0) {
      params.set('keyword', query.keyword.trim());
    }
    // The seed only publishes bookable classes; asking for `published` keeps the
    // grid to what a learner can actually book.
    params.set('state', 'published');
    params.set('limit', String(this.limit));
    params.set('startDate', new Date().toISOString());

    const qs = params.toString();
    const res = await callApi(`/classes${qs ? `?${qs}` : ''}`);
    const page = listClassesPageSchema.parse(await unwrapEnvelope<unknown>(res));
    return page.items;
  }

  /** One class for the detail page; returns null so the route can 404. */
  async findById(id: string): Promise<MarketplaceClass | null> {
    const catalogue = await this.getCatalogue();
    // No single-class marketplace route exists, so the list is scanned for the
    // id. The window is wide enough to include published classes not yet started.
    const params = new URLSearchParams({
      limit: '50',
      state: 'published',
      startDate: new Date().toISOString(),
    });
    const res = await callApi(`/classes?${params.toString()}`);
    const page = listClassesPageSchema.parse(await unwrapEnvelope<unknown>(res));
    const found = page.items.find((item) => item.id === id);
    return found === undefined ? null : toMarketplaceClass(found, catalogue);
  }
}

/** Applies the sidebar filters the backend does not accept. */
function applyClientFilters(
  items: readonly MarketplaceClass[],
  query: MarketplaceQuery,
): MarketplaceClass[] {
  return items.filter((item) => {
    if (query.category && query.category !== 'all' && item.skillCategory !== query.category) {
      return false;
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
    if (query.keyword && query.keyword.trim().length > 0) {
      const needle = query.keyword.trim().toLowerCase();
      const haystack = `${item.skillName} ${item.teacherName}`.toLowerCase();
      if (!haystack.includes(needle)) {
        return false;
      }
    }
    if (query.timeFilter === 'next-24-48h') {
      const hours = (new Date(item.startsAt).getTime() - Date.now()) / 3_600_000;
      if (hours < 24 || hours > 48) {
        return false;
      }
    }
    return true;
  });
}

function applySort(
  items: readonly MarketplaceClass[],
  query: MarketplaceQuery,
): MarketplaceClass[] {
  const copy = [...items];
  switch (query.sort) {
    case 'price-low':
      return copy.sort((a, b) => a.priceCredits - b.priceCredits);
    case 'rating':
      return copy.sort((a, b) => b.ratingAvg - a.ratingAvg);
    case 'popular':
      return copy.sort((a, b) => b.ratingCount - a.ratingCount);
    case 'nearest':
    default:
      return copy.sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
  }
}

export { DEFAULT_QUERY };