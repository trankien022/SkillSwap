const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

/** Quotes a lowercase SQL identifier, rejecting anything unsafe (§4: no string-concat SQL). */
export function ident(value: string): string {
  if (!IDENTIFIER.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${JSON.stringify(value)}`);
  }
  return `"${value}"`;
}

/** schema.table with both parts validated and quoted. */
export function qualified(schema: string, table: string): string {
  return `${ident(schema)}.${ident(table)}`;
}
