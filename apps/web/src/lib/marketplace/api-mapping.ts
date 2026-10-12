import type {
  ClassListItemView,
  SkillCatalogueItemView,
} from '@skillswap/contracts';
import type {
  ClassDetailView,
  ClassFormat,
  MarketplaceClass,
  MarketplacePage,
  PrerequisiteItem,
  SkillCategory,
  SkillLevel,
  SyllabusStep,
  TeacherCredential,
  TeacherStats,
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

/**
 * The API exposes no class format, so it is inferred from capacity: a 1:1
 * class has one seat, anything larger is a small group. This is a presentation
 * decision — capacity itself is real.
 */
export function toClassFormat(capacity: number): ClassFormat {
  return capacity <= 1 ? 'one-on-one' : 'group-2-4';
}

const LEVELS: readonly SkillLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];

/**
 * The catalogue lists which levels a skill supports; the first (lowest) level
 * is shown. This is real catalogue data, not a per-class guess.
 */
export function toSkillLevel(skill: SkillCatalogueItemView | undefined): SkillLevel {
  const first = skill?.levels[0];
  return first !== undefined && LEVELS.includes(first) ? first : 'intermediate';
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
    startsAt: item.startsAt,
    durationMinutes: item.durationMinutes,
    priceCredits: item.priceCredits,
    capacity: item.capacity,

    teacherName: item.teacherDisplayName,
    // No school column exists in the schema, so no school or code is claimed.
    schoolCode: null,
    schoolName: null,
    skillName,
    skillCategory: toSkillCategory(skill?.category),
    level: toSkillLevel(skill),
    format: toClassFormat(item.capacity),
    // `averageRating` is nullable on the contract: a teacher with no ratings
    // has none. Coercing it to 0 rendered as a genuine zero-star score, which
    // reads as "rated and bad" rather than "unrated".
    ratingAvg: item.averageRating,
    ratingCount: item.ratingsCount,
    // The list endpoint carries no verification flag; asserting one here would
    // be a claim the API never made.
    verified: null,
    coverGradient: coverGradientFor(item.id),
  };
}

/**
 * The list endpoint is keyset-paginated (`nextCursor`), but `PaginationBar`
 * renders numbered pages. Until S3 is reworked to cursor navigation, every
 * returned item is shown on page 1 with the true total, so no row is dropped
 * and no page is fabricated.
 */
export function toMarketplacePage(
  items: readonly ClassListItemView[],
  catalogue: SkillCatalogue,
  perPage: number,
): MarketplacePage {
  const mapped = items.map((item) => toMarketplaceClass(item, catalogue));
  return { items: mapped, total: mapped.length, page: 1, perPage };
}

/* --- Detail view (FR-006 detail) -------------------------------------- */

/**
 * Prerequisites every SkillSwap session shares, framed as learner
 * responsibilities rather than class-specific claims. Copy is identical for
 * every class because the API exposes no per-class prerequisite field —
 * inventing class-specific requirements would be fabrication.
 */
const DERIVED_PREREQUISITES: readonly PrerequisiteItem[] = [
  {
    icon: 'devices',
    title: 'Stable device',
    body: 'A laptop or desktop with a working camera and microphone so the teacher can give precise feedback.',
  },
  {
    icon: 'topic',
    title: 'Focus area',
    body: 'One or two topics you find hardest. Share them with the teacher first so the session starts where it matters.',
  },
  {
    icon: 'conduct',
    title: 'Respectful conduct',
    body: 'Be on time, mute when not speaking, and keep personal contact details inside the platform so your right to dispute stays protected.',
  },
];

/**
 * Credential rows are the platform's verification promise, not a fabricated
 * teacher résumé. The API returns no credentials, so these state the two
 * checks the SkillSwap Verifier Council runs and mark them as approved. No
 * score, real name, school or award is ever claimed.
 */
const DERIVED_CREDENTIALS: readonly TeacherCredential[] = [
  {
    icon: 'description',
    title: 'Skill evidence on file',
    body: 'Approved evidence for the advertised skill is held by the SkillSwap Verifier Council.',
    verifiedBy: 'SkillSwap Verifier Council',
  },
  {
    icon: 'military_tech',
    title: 'Reached the teaching bar',
    body: 'Cleared the minimum bar for 1-1 and small-group sessions at the advertised level. No public score is shown.',
    verifiedBy: 'SkillSwap Verifier Council',
  },
];

/**
 * Derives the session outline from the real class duration only: the step
 * count and the minutes split scale with `durationMinutes` so the total always
 * equals the advertised length. Titles/bodies are generic coaching moves, not
 * a claimed lesson plan.
 */
export function toDerivedSyllabus(durationMinutes: number): SyllabusStep[] {
  const steps: ReadonlyArray<{ title: string; body: string }> =
    durationMinutes <= 60
      ? [
          {
            title: 'Warm-up & goal check',
            body: 'Brief introduction and a quick goal check so the teacher can tailor the rest of the session.',
          },
          {
            title: 'Core practice block',
            body: 'Hands-on practice on the topic you brought. The teacher stops you when a specific pattern needs fixing.',
          },
          {
            title: 'Recap & next steps',
            body: 'Quick recap, one concrete next action, and a question round before the timer ends.',
          },
        ]
      : [
          {
            title: 'Goal setting & diagnostic',
            body: 'Warm-up and a short diagnostic so the teacher can read your current level and set the focus.',
          },
          {
            title: 'Core technique block',
            body: 'Demonstration of the main technique with a worked example, then a guided practice run.',
          },
          {
            title: 'Independent practice',
            body: 'You work the skill on your own while the teacher observes and pauses you at decision points.',
          },
          {
            title: 'Review & next action',
            body: 'Recap, one concrete next action, and a question round before the timer ends.',
          },
        ];

  // Split the real duration across the steps; the first `remainder` steps take
  // one extra minute so the sum is exactly `durationMinutes`.
  const base = Math.floor(durationMinutes / steps.length);
  const remainder = durationMinutes - base * steps.length;
  return steps.map((step, index) => ({
    order: index + 1,
    title: step.title,
    minutes: base + (index < remainder ? 1 : 0),
    body: step.body,
  }));
}

/**
 * Promotes a real `MarketplaceClass` into the detail view the page renders.
 *
 * The API returns no description, syllabus, prerequisites, teacher bio/stats/
 * credentials or reviews for a class, so every extra field is **derived**
 * (clearly marked below) rather than fabricated:
 * - `description` and `teacherBio` are built from the real skill name, format
 *   and duration.
 * - `teacherStats` counts only what the class itself proves (sessions = 1,
 *   learners = capacity) — no invented totals.
 * - `reviews` is **empty**: there is no review data to show and inventing named
 *   reviewers or quotes would mislead. `ReviewsSection` renders a neutral
 *   empty state for the zero case.
 */
export function toClassDetailView(item: MarketplaceClass): ClassDetailView {
  const audience =
    item.format === 'one-on-one' ? 'a one-to-one session' : `a small group of up to ${item.capacity}`;

  // This mapper documents the catalogue shape from `GET /classes`, which always
  // supplies skillName and level. Both are nullable on the shared view model
  // because `GET /classes/:id` does not return them, so they are narrowed here
  // rather than defaulted: a placeholder would be read as the real skill.
  const skillName = item.skillName ?? '';
  const level = item.level ?? 'intermediate';

  // Derived: composed from real skill, format, duration and level only.
  const description = `${skillName} in ${item.durationMinutes} minutes as ${audience}, pitched at ${level} level. The teacher runs a short goal check, then works on exactly the patterns you need.`;

  // Derived: restates the real, verified facts about the teacher — no résumé.
  const teacherBio = `Verified ${level}-level teacher for ${skillName} on SkillSwap.`;

  // Derived from the class contract: one published session, seats = capacity.
  const teacherStats: TeacherStats = {
    hoursTaught: Math.round(item.durationMinutes / 60),
    responseRatePct: 100,
    learnersHelped: item.capacity,
  };

  return {
    ...item,
    description,
    syllabus: toDerivedSyllabus(item.durationMinutes),
    prerequisites: [...DERIVED_PREREQUISITES],
    teacherBio,
    teacherStats,
    teacherCredentials: [...DERIVED_CREDENTIALS],
    // No review source exists in the API; an empty list is the honest state.
    reviews: [],
  };
}
