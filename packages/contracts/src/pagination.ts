import { z } from 'zod';

/**
 * NFR-014: pagination for every collection read.
 *
 * Pagination is keyset (cursor) based. `total` is always computed — a `COUNT(*)` over the
 * same filters (ignoring `limit`/`cursor`), run alongside the page query in one transaction.
 */

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/** Shared list query params. Endpoints extend this with their own filters/sort/search. */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
  cursor: z.string().min(1).optional(),
});

/**
 * Free-text search (`RESTful-CONVENTIONS.md` §5.3): one name, `q`, on every collection.
 *
 * `keyword` was the original name on the class and skill collections and is kept as a
 * documented alias for one release so shipped clients do not break; `q` wins when both
 * are sent. Read it through `resolveSearchTerm` rather than touching the fields directly.
 */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  /** @deprecated Use `q`. Accepted for one release. */
  keyword: z.string().trim().min(1).max(120).optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/** The effective search term: canonical `q`, falling back to the legacy `keyword` alias. */
export function resolveSearchTerm(query: {
  readonly q?: string;
  readonly keyword?: string;
}): string | undefined {
  const term = query.q ?? query.keyword;
  return term === undefined || term.trim() === '' ? undefined : term.trim();
}
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Page metadata returned with a collection. */
export const pageMetaSchema = z.object({
  limit: z.number().int().min(1).max(MAX_PAGE_LIMIT),
  // Opaque keyset cursor; null on the last page.
  nextCursor: z.string().min(1).nullable(),
  // Total rows matching the filters (ignores limit/cursor).
  total: z.number().int().min(0),
});
export type PageMeta = z.infer<typeof pageMetaSchema>;

/** A page of a collection: the items plus their page metadata. */
export function pagedSchema<TItem extends z.ZodTypeAny>(item: TItem) {
  return z.object({
    items: z.array(item),
    page: pageMetaSchema,
  });
}

/**
 * The `page` member of a collection response. Bounded collections that are intentionally not
 * paginated (e.g. profile skills, bounded by the skill catalogue) use `null` with a single
 * `items` array instead of a `page` object.
 */
export type Paged<T> = { items: T[]; page: PageMeta };
