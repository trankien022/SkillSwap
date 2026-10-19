import {
  listClassesPageSchema,
  skillCataloguePageSchema,
  type ClassLifecycleState,
  type ListClassesPageView,
  type SkillCatalogueItemView,
  type SkillCataloguePageView,
} from '@skillswap/contracts';
import type { GatewayClient } from './gateway-client';

export interface ListClassesQueryOptions {
  readonly keyword?: string;
  readonly skillId?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly teacherId?: 'me' | string;
  readonly state?: ClassLifecycleState;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface ListSkillsQueryOptions {
  readonly category?: string;
  readonly keyword?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface BoundedSkillsResult {
  readonly items: SkillCatalogueItemView[];
  readonly nextCursor: string | null;
  readonly isComplete: boolean;
}

/**
 * Gateway adapter for reading live classes (marketplace / own teaching)
 * and the standardized skill catalogue.
 *
 * Implements:
 * - Route 13: GET /api/classes with URLSearchParams query filters and keyset cursor pagination.
 * - Route 09: GET /api/skills with catalogue search and keyset cursor pagination.
 * - Bounded multi-page catalogue loader with explicit completion signals and cycle detection.
 * - Avoids serializing undefined query parameters into URL strings.
 * - Relies on GatewayClient.authenticatedRequest as the sole HTTP retry owner.
 */
export class ClassReadGateway {
  constructor(private readonly gateway: GatewayClient) {}

  async getClassesPage(query?: ListClassesQueryOptions): Promise<ListClassesPageView> {
    const params = new URLSearchParams();

    if (query?.keyword !== undefined && query.keyword.trim().length > 0) {
      params.set('q', query.keyword.trim());
    }
    if (query?.skillId !== undefined && query.skillId.trim().length > 0) {
      params.set('skillId', query.skillId.trim());
    }
    if (query?.startDate !== undefined && query.startDate.trim().length > 0) {
      params.set('startDate', query.startDate.trim());
    }
    if (query?.endDate !== undefined && query.endDate.trim().length > 0) {
      params.set('endDate', query.endDate.trim());
    }
    if (query?.teacherId !== undefined && query.teacherId.trim().length > 0) {
      params.set('teacherId', query.teacherId.trim());
    }
    if (query?.state !== undefined) {
      params.set('state', query.state);
    }
    if (query?.limit !== undefined && query.limit > 0) {
      params.set('limit', String(query.limit));
    }
    if (query?.cursor !== undefined && query.cursor.trim().length > 0) {
      params.set('cursor', query.cursor.trim());
    }

    const queryString = params.toString();
    const path = `/classes${queryString ? `?${queryString}` : ''}`;

    const raw = await this.gateway.authenticatedRequest<unknown>(path, {
      method: 'GET',
    });

    return listClassesPageSchema.parse(raw);
  }

  async getSkillsPage(query?: ListSkillsQueryOptions): Promise<SkillCataloguePageView> {
    const params = new URLSearchParams();

    if (query?.category !== undefined && query.category.trim().length > 0) {
      params.set('category', query.category.trim());
    }
    if (query?.keyword !== undefined && query.keyword.trim().length > 0) {
      params.set('q', query.keyword.trim());
    }
    if (query?.limit !== undefined && query.limit > 0) {
      params.set('limit', String(query.limit));
    }
    if (query?.cursor !== undefined && query.cursor.trim().length > 0) {
      params.set('cursor', query.cursor.trim());
    }

    const queryString = params.toString();
    const path = `/skills${queryString ? `?${queryString}` : ''}`;

    const raw = await this.gateway.authenticatedRequest<unknown>(path, {
      method: 'GET',
    });

    return skillCataloguePageSchema.parse(raw);
  }

  /**
   * Fetches skills across bounded pages using nextCursor.
   * Returns accumulated items, the next unresolved cursor (if incomplete),
   * and an explicit isComplete flag. Safeguards against repeated cursors and
   * deduplicates item IDs across pages.
   */
  async getAllSkills(
    maxPages = 10,
    pageSize = 50,
    initialCursor?: string,
  ): Promise<BoundedSkillsResult> {
    const allSkills: SkillCatalogueItemView[] = [];
    const seenIds = new Set<string>();
    const seenCursors = new Set<string>();
    let cursor: string | undefined = initialCursor;
    let pagesFetched = 0;

    while (pagesFetched < maxPages) {
      if (cursor) {
        if (seenCursors.has(cursor)) {
          // Repeated cursor detected; terminate loop safely without hanging
          return { items: allSkills, nextCursor: null, isComplete: false };
        }
        seenCursors.add(cursor);
      }

      const page = await this.getSkillsPage({ limit: pageSize, cursor });
      for (const item of page.items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          allSkills.push(item);
        }
      }
      pagesFetched++;

      if (!page.nextCursor) {
        return { items: allSkills, nextCursor: null, isComplete: true };
      }

      cursor = page.nextCursor;
    }

    // Bounded maxPages reached, but catalogue has further pages
    return { items: allSkills, nextCursor: cursor ?? null, isComplete: false };
  }
}
