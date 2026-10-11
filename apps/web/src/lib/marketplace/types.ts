import type { ClassView } from '@skillswap/contracts';

/**
 * Marketplace domain types (FR-006 mock layer).
 *
 * Extends the contract `ClassView` with the presentation fields the
 * marketplace UI needs to render a card: teacher name, school, skill label,
 * rating, and a deterministic gradient placeholder for the cover area.
 *
 * The base `ClassView` shape (id, teacherId, state, startsAt,
 * durationMinutes, priceCredits, capacity) is reused as-is from
 * `apps/api/src/modules/live-class/.../class.ts` and mirrored in
 * `packages/contracts/src/index.ts` (classSchema) so the mock can be
 * swapped for a real HTTP gateway later without changing UI components.
 */

export type ClassFormat = 'one-on-one' | 'group-2-4';

export type SkillCategory =
  | 'language'
  | 'programming'
  | 'design'
  | 'soft-skills'
  | 'math';

export type UniversityCode =
  | 'bk'
  | 'ftu'
  | 'ueh'
  | 'uit'
  | 'kien-truc'
  | 'ussh';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type SortOrder = 'nearest' | 'rating' | 'price-low' | 'popular';

export type TimeFilter = 'all-valid' | 'next-24-48h' | 'this-weekend';

export interface MarketplaceClass extends ClassView {
  teacherName: string;
  schoolCode: UniversityCode;
  schoolName: string;
  skillName: string;
  skillCategory: SkillCategory;
  level: SkillLevel;
  format: ClassFormat;
  ratingAvg: number;
  ratingCount: number;
  verified: boolean;
  /** Two hex colors used to render a subtle slate+emerald gradient cover. */
  coverGradient: { from: string; to: string };
}

export interface MarketplaceQuery {
  keyword?: string;
  university?: UniversityCode | 'all';
  category?: SkillCategory | 'all';
  formats: ClassFormat[];
  timeFilter: TimeFilter;
  minRating?: number;
  priceMin?: number;
  priceMax?: number;
  verifiedOnly?: boolean;
  sort: SortOrder;
  page: number;
  perPage: number;
}

export interface MarketplacePage {
  items: MarketplaceClass[];
  total: number;
  page: number;
  perPage: number;
}

/** Categories shown in the quick-pills row, mirrored by `Landing.categories`. */
export const SKILL_CATEGORIES: ReadonlyArray<SkillCategory> = [
  'language',
  'programming',
  'design',
  'soft-skills',
  'math',
];

/** Universities selectable in the search hub (codes match `Landing.search.universities`). */
export const UNIVERSITY_CODES: ReadonlyArray<UniversityCode> = [
  'bk',
  'ftu',
  'ueh',
  'uit',
  'kien-truc',
  'ussh',
];
