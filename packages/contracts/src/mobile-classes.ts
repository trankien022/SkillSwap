import { z } from 'zod';

export type ClassCursorTuple = readonly [startsAtISO: string, id: string];

export const CLASS_CURSOR_MAX_LENGTH = 512;
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
 * Encodes a deterministic [startsAtISO, id] tuple into a bounded, opaque base64url JSON string.
 * Uses portable btoa and encodeURIComponent without Buffer or TextEncoder polyfills.
 */
export function encodeClassCursor(tuple: ClassCursorTuple): string {
  const json = JSON.stringify([tuple[0], tuple[1]]);
  const binary = utf8ToBinaryString(json);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes and validates a base64url JSON tuple [startsAtISO, id].
 * Applies explicit base64 padding before atob (required by React Native Hermes / issue 1379).
 * Rejects malformed encodings, wrong shapes, empty strings, invalid date strings, and non-canonical representations.
 */
export function decodeClassCursor(cursor: string): [string, string] {
  if (typeof cursor !== 'string' || cursor.length === 0 || cursor.length > CLASS_CURSOR_MAX_LENGTH) {
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

  if (!Array.isArray(parsed) || parsed.length !== 2) {
    throw new Error('Cursor JSON must be a 2-element tuple');
  }

  const [startsAtISO, id] = parsed;
  if (
    typeof startsAtISO !== 'string' ||
    startsAtISO.trim() === '' ||
    typeof id !== 'string' ||
    id.trim() === ''
  ) {
    throw new Error('Cursor tuple elements must be non-empty strings');
  }

  const parsedTime = new Date(startsAtISO).getTime();
  if (Number.isNaN(parsedTime)) {
    throw new Error('Cursor startsAt is not a valid date string');
  }

  const canonical = encodeClassCursor([startsAtISO, id]);
  if (canonical !== cursor) {
    throw new Error('Cursor is not canonically encoded');
  }

  return [startsAtISO, id];
}

export function isValidClassCursor(cursor: unknown): boolean {
  if (typeof cursor !== 'string') return false;
  try {
    decodeClassCursor(cursor);
    return true;
  } catch {
    return false;
  }
}

/**
 * 6 domain lifecycle states of a Class (FR-005, FR-007, FR-020).
 */
export const classLifecycleStateSchema = z.enum([
  'draft',
  'published',
  'full',
  'in_progress',
  'completed',
  'cancelled',
]);
export type ClassLifecycleState = z.infer<typeof classLifecycleStateSchema>;

/**
 * Route 13 / FR-005, FR-006: query parameters for listing classes.
 * Keyset cursor pagination bounded to max 50 per page, default 20.
 * Supports keyword description search, skillId filter, date range, teacherId ('me' or UUID), state filter, and portable cursor.
 */
export const listClassesQuerySchema = z
  .object({
    keyword: z.string().trim().min(1).optional(),
    skillId: z.string().trim().min(1).optional(),
    startDate: z.string().datetime({ offset: true }).optional(),
    endDate: z.string().datetime({ offset: true }).optional(),
    teacherId: z.union([z.literal('me'), z.string().uuid()]).optional(),
    state: classLifecycleStateSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z
      .string()
      .trim()
      .max(CLASS_CURSOR_MAX_LENGTH)
      .refine(isValidClassCursor, {
        message: 'Invalid class cursor; must be a canonically encoded base64url JSON tuple [startsAtISO, id]',
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate).getTime() <= new Date(data.endDate).getTime();
      }
      return true;
    },
    {
      message: 'startDate must be less than or equal to endDate',
      path: ['endDate'],
    },
  );
export type ListClassesQueryInput = z.infer<typeof listClassesQuerySchema>;

/**
 * Route 13: class item in marketplace or own teaching list.
 * Includes seats count, confirmed count, provisional rating fields (rating table not yet implemented).
 */
export const classListItemSchema = z.object({
  id: z.string().min(1),
  teacherId: z.string().min(1),
  teacherDisplayName: z.string().min(1),
  skillIds: z.array(z.string().min(1)),
  description: z.string().min(1),
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int(),
  priceCredits: z.number().int().positive(),
  capacity: z.number().int().positive(),
  confirmedBookingsCount: z.number().int().nonnegative(),
  availableSeats: z.number().int().nonnegative(),
  state: classLifecycleStateSchema,
  averageRating: z.number().min(0).max(5).nullable(),
  ratingsCount: z.number().int().nonnegative(),
});
export type ClassListItemView = z.infer<typeof classListItemSchema>;

/**
 * Route 13: paginated classes page with keyset nextCursor.
 * totalActiveTeachingCount is only present when querying own teaching (teacherId='me').
 */
export const listClassesPageSchema = z.object({
  items: z.array(classListItemSchema),
  nextCursor: z.string().nullable(),
  totalActiveTeachingCount: z.number().int().nonnegative().optional(),
});
export type ListClassesPageView = z.infer<typeof listClassesPageSchema>;
