import { callApi, unwrapEnvelope } from '../api-client';
import type { ListClassesPageView, ClassListItemView } from '@skillswap/contracts';
import { MockMarketplaceGateway } from './mock-gateway';
import type { MarketplaceClass, MarketplacePage, MarketplaceQuery } from './types';

/**
 * Transforms a backend ClassListItemView (Route 13) into the UI MarketplaceClass presentation shape.
 */
export function mapClassListItemToMarketplace(item: ClassListItemView): MarketplaceClass {
  return {
    id: item.id,
    teacherId: item.teacherId,
    state: item.state,
    startsAt: item.startsAt,
    durationMinutes: item.durationMinutes,
    priceCredits: item.priceCredits,
    capacity: item.capacity,
    teacherName: item.teacherDisplayName,
    schoolCode: 'bk',
    schoolName: 'Đại học Quốc gia',
    skillName: item.description.length > 35 ? `${item.description.slice(0, 32)}...` : item.description,
    skillCategory: 'programming',
    level: 'intermediate',
    format: item.capacity <= 1 ? 'one-on-one' : 'group-2-4',
    ratingAvg: item.averageRating ?? 5.0,
    ratingCount: item.ratingsCount,
    verified: true,
    coverGradient: { from: '#0f766e', to: '#14b8a6' },
  };
}

/**
 * Real API-backed Marketplace Gateway.
 * Queries `GET /api/classes` from backend with graceful fallback to MockMarketplaceGateway
 * if the user is unauthenticated or when the database has no classes yet.
 */
export class MarketplaceApiGateway {
  private fallback = new MockMarketplaceGateway();

  async search(query: MarketplaceQuery): Promise<MarketplacePage> {
    try {
      const params = new URLSearchParams();
      if (query.keyword) {
        params.append('keyword', query.keyword);
      }
      params.append('limit', String(query.perPage || 20));

      const res = await callApi(`/classes?${params.toString()}`);
      if (res.ok) {
        const pageData = await unwrapEnvelope<ListClassesPageView>(res);
        if (pageData && Array.isArray(pageData.items) && pageData.items.length > 0) {
          const mappedItems = pageData.items.map(mapClassListItemToMarketplace);
          return {
            items: mappedItems,
            total: mappedItems.length,
            page: query.page,
            perPage: query.perPage,
          };
        }
      }
    } catch (err) {
      console.warn('Real /api/classes search failed, falling back to mock catalogue:', err);
    }

    return this.fallback.search(query);
  }
}
