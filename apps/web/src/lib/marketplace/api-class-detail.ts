import { callApi, unwrapEnvelope } from '../api-client';
import type { ClassDetailView as ContractClassDetailView } from '@skillswap/contracts';
import { toSkillCategory, toSkillLevel } from './api-mapping';
import { MockClassDetailGateway } from './mock-class-detail';
import type { ClassDetailView } from './types';

/**
 * Transforms a backend ClassDetailView (Route 14) into the web ClassDetailView
 * presentation shape.
 *
 * The API answers with `teacher { displayName, averageRating, ratingsCount }`,
 * `description`, `startsAt`, `durationMinutes`, `priceCredits`, `capacity`,
 * `availableSeats`, `state`, `skillIds`, `skills` and `recentRatings` — nothing else.
 *
 * `skills` is the catalogue join the API performs, so the page no longer has to fetch
 * the whole catalogue (or scan the class list) to learn what the class teaches. It is
 * optional on the contract: when the catalogue read failed the field is absent, and
 * skill name/category/level fall back to their "not provided" state.
 *
 * Everything the richer web layout can also show but the API does **not**
 * provide (school, syllabus, prerequisites, teacher bio,
 * teacher stats, credentials) is therefore left genuinely empty or null rather
 * than invented. An earlier version of this function filled them with
 * plausible-looking constants — `schoolCode: 'bk'`, `ratingAvg ?? 5.0`,
 * `verified: true`, a three-step syllabus, a bio, `hoursTaught: 16` — which
 * rendered as real class content and was indistinguishable from it. Absence is
 * visible; a fabricated 5.0 rating is not.
 */
export function mapContractDetailToWeb(detail: ContractClassDetailView): ClassDetailView {
  /**
   * The class's first skill, resolved by the API. Absent when the catalogue read
   * failed, so `skillName`/`skillCategory`/`level` fall back to their "not provided"
   * state rather than to a guess.
   */
  const skill = detail.skills?.[0];

  return {
    id: detail.id,
    teacherId: detail.teacher.id,
    state: detail.state,
    startsAt: detail.startsAt,
    durationMinutes: detail.durationMinutes,
    priceCredits: detail.priceCredits,
    capacity: detail.capacity,
    teacherName: detail.teacher.displayName,
    // Not supplied by `GET /classes/:id`; the UI must render an explicit
    // "not provided" state rather than a placeholder that reads as fact.
    schoolCode: null,
    schoolName: null,
    skillName: skill?.name ?? null,
    skillCategory: skill === undefined ? null : toSkillCategory(skill.category),
    level: skill === undefined ? null : toSkillLevel({ levels: skill.levels }),
    // Derived only from data the API actually returns.
    format: detail.capacity <= 1 ? 'one-on-one' : 'group-2-4',
    // `averageRating` is nullable: a teacher with no ratings has no average, and
    // coercing null to 5.0 was a fabricated perfect score.
    ratingAvg: detail.teacher.averageRating,
    ratingCount: detail.teacher.ratingsCount,
    // "Verified" is a claim about the teacher. The API sends no such flag here,
    // so it is reported as unknown instead of asserted true.
    verified: null,
    coverGradient: { from: '#0f766e', to: '#14b8a6' },
    description: detail.description,
    // None of these are returned by the API.
    syllabus: [],
    prerequisites: [],
    teacherBio: null,
    teacherStats: null,
    teacherCredentials: [],
    // Free seats come straight from Route 14; nothing is derived from capacity.
    availableSeats: detail.availableSeats,
    // The server's verdict for this caller, copied across unchanged. `false`
    // means "not bookable" (own class, full, too soon, already booked) — never
    // an optimistic `true` — and `ownBooking` is what makes an existing hold
    // visible to the web client, which could not see one at all before.
    canBook: detail.canBook,
    ownBooking: detail.ownBooking ?? null,
    reviews: (detail.recentRatings ?? []).map((r) => ({
      id: r.id,
      authorName: r.learnerDisplayName,
      // The API returns no school for a reviewer, so none is shown.
      schoolName: null,
      rating: r.stars,
      body: r.comment,
      attendedOn: r.createdAt,
    })),
  };
}

/**
 * Class Detail Gateway.
 *
 * Two sources, in a fixed order:
 *  1. the demo fixtures in `MockClassDetailGateway`, keyed by demo ids like
 *     `demo-ielts-speaking` (there is no such class in the database);
 *  2. `GET /classes/:id`, for real UUIDs.
 *
 * A real class the API cannot resolve returns null. There is no local
 * reconstruction of one: `mapContractDetailToWeb` fills only the fields the API
 * actually returns, so an unresolvable class surfaces as not-found instead of a
 * plausible-looking invention that is indistinguishable from a real detail.
 */
export class ClassDetailApiGateway {
  private fallback = new MockClassDetailGateway();

  async getById(id: string): Promise<ClassDetailView | null> {
    // 1. Demo fixtures are keyed by their own non-UUID ids, so this cannot shadow
    //    a real class. It exists so the seeded demo links still resolve offline.
    const mockItem = await this.fallback.getById(id);
    if (mockItem) {
      return mockItem;
    }

    // 2. Query backend for real class by UUID
    try {
      const res = await callApi(`/classes/${id}`);
      if (!res.ok) {
        console.warn(`GET /api/classes/${id} failed: HTTP ${res.status}`);
        return null;
      }
      const detail = await unwrapEnvelope<ContractClassDetailView>(res);
      if (detail && detail.id) {
        return mapContractDetailToWeb(detail);
      }
    } catch (err) {
      console.warn(`Failed to fetch /api/classes/${id}:`, err);
    }

    // No local fallback. A class that the API cannot resolve does not exist as
    // far as the app is concerned; an earlier version reconstructed one from a
    // `skillswap_created_classes` localStorage entry, inventing the teacher name,
    // a 5.0 rating and teacher stats. Callers show a not-found state instead.
    return null;
  }
}
