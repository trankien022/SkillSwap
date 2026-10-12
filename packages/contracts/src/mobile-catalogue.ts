import { z } from 'zod';

export type SkillCursorTuple = readonly [category: string, name: string, id: string];

export const SKILL_CURSOR_MAX_LENGTH = 512;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Converts a UTF-8 string to a binary string (charCode 0..255 per byte)
 * using encodeURIComponent byte representation without Buffer or unescape.
 * Throws URIError on malformed UTF-8 (e.g. lone surrogates).
 */
function utf8ToBinaryString(str: string): string {
  return encodeURIComponent(str).replace(/%([0-9A-Fa-f]{2})/g, (_match, byteHex) =>
    String.fromCharCode(parseInt(byteHex, 16)),
  );
}

/**
 * Converts a binary string (charCode 0..255 per byte) back to a UTF-8 string
 * using decodeURIComponent.
 * Throws on invalid or incomplete UTF-8 byte sequences without replacement characters.
 */
function binaryStringToUtf8(binary: string): string {
  let percentEncoded = '';
  for (let i = 0; i < binary.length; i++) {
    const code = binary.charCodeAt(i);
    percentEncoded += '%' + code.toString(16).padStart(2, '0');
  }
  return decodeURIComponent(percentEncoded);
}

/**
 * Encodes a deterministic [category, name, id] tuple into a bounded, opaque base64url JSON string.
 * Uses portable btoa and encodeURIComponent without Buffer or TextEncoder polyfills.
 */
export function encodeSkillCursor(tuple: SkillCursorTuple): string {
  const json = JSON.stringify([tuple[0], tuple[1], tuple[2]]);
  const binary = utf8ToBinaryString(json);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes and validates a base64url JSON tuple [category, name, id].
 * Applies explicit base64 padding before atob (required by React Native Hermes / issue 1379).
 * Rejects malformed encodings, wrong shapes, empty strings, malformed UTF-8, and non-canonical representations.
 */
export function decodeSkillCursor(cursor: string): [string, string, string] {
  if (typeof cursor !== 'string' || cursor.length === 0 || cursor.length > SKILL_CURSOR_MAX_LENGTH) {
    throw new Error('Cursor must be a non-empty string within bounded size limit');
  }
  if (!BASE64URL_PATTERN.test(cursor)) {
    throw new Error('Cursor is not valid base64url');
  }
  if (cursor.length % 4 === 1) {
    throw new Error('Invalid base64url length');
  }

  // Restore base64 characters and add explicit Hermes-compatible padding
  let base64 = cursor.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new Error('Failed to decode base64 cursor');
  }

  let json: string;
  try {
    json = binaryStringToUtf8(binary);
  } catch {
    throw new Error('Malformed UTF-8 sequence in cursor');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Cursor does not contain valid JSON');
  }

  if (!Array.isArray(parsed) || parsed.length !== 3) {
    throw new Error('Cursor JSON must be a 3-element tuple');
  }

  const [category, name, id] = parsed;
  if (
    typeof category !== 'string' ||
    category.trim() === '' ||
    typeof name !== 'string' ||
    name.trim() === '' ||
    typeof id !== 'string' ||
    id.trim() === ''
  ) {
    throw new Error('Cursor tuple elements must be non-empty strings');
  }

  const canonical = encodeSkillCursor([category, name, id]);
  if (canonical !== cursor) {
    throw new Error('Cursor is not canonically encoded');
  }

  return [category, name, id];
}

export function isValidSkillCursor(cursor: unknown): boolean {
  if (typeof cursor !== 'string') return false;
  try {
    decodeSkillCursor(cursor);
    return true;
  } catch {
    return false;
  }
}

/**
 * Route 09 / FR-003: query parameters for listing standardized catalogue skills.
 * Keyset cursor pagination bounded to max 100 per page.
 * Uses agreed 'keyword' search only (no duplicate undocumented search alias).
 */
export const listSkillsQuerySchema = z.object({
  category: z.string().trim().min(1).optional(),
  keyword: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z
    .string()
    .trim()
    .max(SKILL_CURSOR_MAX_LENGTH)
    .refine(isValidSkillCursor, {
      message: 'Invalid skill cursor; must be a canonically encoded base64url JSON tuple [category, name, id]',
    })
    .optional(),
});
export type ListSkillsQueryInput = z.infer<typeof listSkillsQuerySchema>;

/**
 * ADR-026: ordered skill level scale.
 */
export const skillCatalogueLevelSchema = z.enum(['beginner', 'intermediate', 'advanced', 'expert']);
export type SkillCatalogueLevel = z.infer<typeof skillCatalogueLevelSchema>;

/**
 * Route 09 / FR-003: catalogue skill item with available proficiency levels.
 * Explicit levels array required; no schema defaults silently fabricating missing levels.
 */
export const skillCatalogueItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  levels: z.array(skillCatalogueLevelSchema),
});
export type SkillCatalogueItemView = z.infer<typeof skillCatalogueItemSchema>;

/**
 * Route 09 / FR-003: paginated catalogue page with keyset nextCursor.
 */
export const skillCataloguePageSchema = z.object({
  items: z.array(skillCatalogueItemSchema),
  nextCursor: z.string().nullable(),
});
export type SkillCataloguePageView = z.infer<typeof skillCataloguePageSchema>;
