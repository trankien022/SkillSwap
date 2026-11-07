/**
 * The small, closed vocabularies a class view reports.
 *
 * Kept in one leaf instead of repeated per port: `list-classes` and `get-class-detail` describe the
 * same class, so a badge or format that meant one thing in the list and another in the detail page
 * would be a silent contradiction. Pure data — no imports, so either port may depend on it.
 */

/** B2: the level a class is taught at, mirroring `skill-level.ts` and the shared contract. */
export const CLASS_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
export type ClassLevelDto = (typeof CLASS_LEVELS)[number];

/** B3: how many learners a class serves — mirrored from `domain/class.ts`. */
export const CLASS_FORMATS = ['one-on-one', 'group'] as const;
export type ClassFormatDto = (typeof CLASS_FORMATS)[number];
