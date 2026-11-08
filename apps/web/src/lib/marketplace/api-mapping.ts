import type {
  ClassListItemView,
  SkillCatalogueItemView,
} from '@skillswap/contracts';
import type {
  MarketplaceClass,
  SkillCategory,
  SkillLevel,
} from './types';

/**
 * Maps the live API payloads onto the marketplace's presentation model.
 *
 * The API is the source of truth for everything a learner can be judged on:
 * price, capacity, seats, start time, duration, teacher, rating and the skills
 * taught. Those are copied straight across.
 *
 * The marketplace UI additionally renders a cover gradient, a school line, a
 * level chip and a badge. None of those exist in the schema, so they are
 * **derived deterministically** from real fields (see each helper) rather than
 * invented per class. Deriving keeps the two clients visually consistent and
 * guarantees the same class always renders the same way.
 */

/** The API's skill catalogue keyed by id, used to resolve names and categories. */
export type SkillCatalogue = ReadonlyMap<string, SkillCatalogueItemView>;

/**
 * The seed's categories are free-form strings (`Languages`, `Programming`,
 * `Music`, `Math`, `Design`). The UI's pill row uses its own slug union, so
 * unknown categories fall back to the first pill rather than dropping data.
 */
export function toSkillCategory(raw: string | undefined): SkillCategory {
  switch ((raw ?? '').trim().toLowerCase()) {
    case 'language':
    case 'languages':
      return 'language';
    case 'programming':
      return 'programming';
    case 'design':
      return 'design';
    case 'math':
    case 'mathematics':
      return 'math';
    case 'soft-skills':
    case 'soft skills':
      return 'soft-skills';
    default:
      return 'soft-skills';
  }
}

const LEVELS: readonly SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];

/**
 * The catalogue lists which levels a skill supports; the first (lowest) level
 * is shown. This is real catalogue data, not a per-class guess.
 */
export function toSkillLevel(skill: { readonly levels: readonly string[] } | undefined): SkillLevel {
  const first = skill?.levels[0];
  return first !== undefined && LEVELS.includes(first as SkillLevel) ? (first as SkillLevel) : 'intermediate';
}

/**
 * Cover gradients: the design system allows only slate/mist/emerald neutrals,
 * so the palette is fixed and the class id only chooses *which* pairing, keeping
 * the grid varied without inventing colours or implying per-class artwork.
 */
const COVER_THEMES: readonly { from: string; to: string }[] = [
  { from: '#0f172a', to: '#1e293b' },
  { from: '#064e3b', to: '#10b981' },
  { from: '#134e4a', to: '#14b8a6' },
  { from: '#1e293b', to: '#64748b' },
];

/** Stable string hash so the same class always gets the same cover. */
function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function coverGradientFor(id: string): { from: string; to: string } {
  return COVER_THEMES[hashId(id) % COVER_THEMES.length];
}

/**
 * `teacherDisplayName` is the only teacher field the list endpoint returns, and
 * there is no school column anywhere in the schema. So both the school code and
 * the school line are visibly absent rather than filled with a fabricated
 * affiliation.
 */
export function toMarketplaceClass(
  item: ClassListItemView,
  catalogue: SkillCatalogue,
): MarketplaceClass {
  const skill = item.skillIds.map((id) => catalogue.get(id)).find((s) => s !== undefined);
  const skillName = skill?.name ?? 'Class';

  return {
    id: item.id,
    teacherId: item.teacherId,
    state: item.state,
    title: item.title,
    startsAt: item.startsAt,
    durationMinutes: item.durationMinutes,
    priceCredits: item.priceCredits,
    capacity: item.capacity,

    teacherName: item.teacherDisplayName,
    // B4: the API reports the school as free text, and no `UniversityCode` vocabulary exists on
    // the wire — mapping a name onto one of the app's six codes would be a guess. `schoolCode`
    // therefore stays null (the code-based dropdown still cannot filter API data); the name and
    // the verified flag below are real and drive "verified only" and the card's school line.
    schoolCode: null,
    schoolName: item.schoolName,
    skillName,
    skillCategory: toSkillCategory(skill?.category),
    // B2: the class reports the level it is taught at. The catalogue fallback only applies to
    // rows recorded before the column existed (`null`), where no per-class level is known —
    // it is the old, lowest-in-catalogue guess, not a new claim.
    level: item.level ?? toSkillLevel(skill),
    format: item.format,
    // `averageRating` is nullable on the contract: a teacher with no ratings
    // has none. Coercing it to 0 rendered as a genuine zero-star score, which
    // reads as "rated and bad" rather than "unrated".
    ratingAvg: item.averageRating,
    ratingCount: item.ratingsCount,
    // B4: the flag is now on the payload, so the "verified only" toggle can filter for real.
    verified: item.verified,
    coverGradient: coverGradientFor(item.id),
    // Free seats as reported by the catalogue — used for the "full" reason on
    // the detail action, never defaulted (absent stays absent).
    availableSeats: item.availableSeats,
  };
}
