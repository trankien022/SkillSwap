/**
 * Normalizes a raw TypeORM Postgres query result.
 *
 * The pg driver returns `[rows, rowCount]` for `UPDATE`/`DELETE` statements but
 * a plain `rows` array for `SELECT`/`INSERT`. Repository code that needs the
 * returned rows must use this so an `UPDATE ... RETURNING` reads its rows, not
 * the `[rows, count]` tuple.
 */
export function returnedRows<T>(raw: unknown): T[] {
  if (Array.isArray(raw) && Array.isArray(raw[0]) && typeof raw[1] === 'number') {
    return raw[0] as T[];
  }
  return (raw as T[]) ?? [];
}

/** The affected-row count of an UPDATE/DELETE result (0 for other statements). */
export function affectedRows(raw: unknown): number {
  if (Array.isArray(raw) && Array.isArray(raw[0]) && typeof raw[1] === 'number') {
    return raw[1] as number;
  }
  return Array.isArray(raw) ? raw.length : 0;
}
