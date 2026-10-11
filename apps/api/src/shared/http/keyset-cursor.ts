/**
 * NFR-014: generic keyset (cursor) pagination helpers, shared by list adapters.
 *
 * A cursor is the opaque base64 encoding of the last row's sort key(s). Adapters must use a
 * stable sort (a unique tiebreaker, usually the primary key) so paging never skips or repeats.
 * This module is transport/persistence-neutral: it encodes strings only.
 */

/** Encodes a cursor from one or more ordered key parts. */
export function encodeCursor(parts: readonly (string | number)[]): string {
  const payload = parts.map((part) => String(part)).join('|');
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/** Decodes a cursor back to its ordered key parts, or `null` when absent or malformed. */
export function decodeCursor(cursor: string | undefined): string[] | null {
  if (cursor === undefined || cursor.length === 0) {
    return null;
  }
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parts = decoded.split('|');
    return parts.length === 0 || parts.some((part) => part.length === 0) ? null : parts;
  } catch {
    return null;
  }
}

export interface KeysetPage<T> {
  items: T[];
  /** Cursor for the next page, or null when this is the last page. */
  nextCursor: string | null;
}

/**
 * Splits a `limit + 1` peek-ahead result set into a page and its next cursor.
 *
 * `keyOf` extracts the cursor key parts (in the same order as the SQL sort) from a row.
 */
export function toKeysetPage<TRow>(
  rows: readonly TRow[],
  limit: number,
  keyOf: (row: TRow) => readonly (string | number)[],
): KeysetPage<TRow> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : [...rows];
  const last = items[items.length - 1];
  const nextCursor = hasMore && last !== undefined ? encodeCursor(keyOf(last)) : null;
  return { items, nextCursor };
}
