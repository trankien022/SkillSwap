import { describe, expect, it } from 'vitest';
import { ClassDetailApiGateway, mapContractDetailToWeb } from './api-class-detail';
import type { ClassDetailView as ContractClassDetailView } from '@skillswap/contracts';

describe('ClassDetailApiGateway', () => {
  const sampleContractDetail: ContractClassDetailView = {
    id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
    teacher: {
      id: 'teacher-1',
      displayName: 'Lê Minh',
      averageRating: 4.9,
      ratingsCount: 15,
    },
    skillIds: ['skill-ds-1'],
    description: 'Cấu trúc dữ liệu và giải thuật nâng cao',
    startsAt: '2026-10-25T14:00:00.000Z',
    durationMinutes: 120,
    priceCredits: 80,
    capacity: 3,
    availableSeats: 2,
    state: 'published',
    canBook: true,
    recentRatings: [
      {
        id: 'rating-1',
        learnerDisplayName: 'Học viên A',
        stars: 5,
        comment: 'Bài giảng rất dễ hiểu!',
        createdAt: '2026-10-10T12:00:00.000Z',
      },
    ],
  };

  it('maps only the fields the API actually returns, inventing nothing', () => {
    const webView = mapContractDetailToWeb(sampleContractDetail);

    // Real fields pass through unchanged.
    expect(webView.id).toBe(sampleContractDetail.id);
    expect(webView.teacherName).toBe('Lê Minh');
    expect(webView.priceCredits).toBe(80);
    expect(webView.format).toBe('group-2-4');
    expect(webView.description).toBe('Cấu trúc dữ liệu và giải thuật nâng cao');
    expect(webView.reviews).toHaveLength(1);
    expect(webView.reviews[0]?.authorName).toBe('Học viên A');

    // Fields the API does NOT return stay absent. This test previously asserted
    // a non-empty syllabus and prerequisites — i.e. it locked in the fabricated
    // three-step outline and the invented school/rating/bio. Absence is the
    // honest state, so it is what is asserted now.
    expect(webView.syllabus).toEqual([]);
    expect(webView.prerequisites).toEqual([]);
    expect(webView.teacherCredentials).toEqual([]);
    expect(webView.teacherBio).toBeNull();
    expect(webView.teacherStats).toBeNull();
    expect(webView.schoolCode).toBeNull();
    expect(webView.schoolName).toBeNull();
    expect(webView.verified).toBeNull();
    // The reviewer's school is not returned, so none is claimed.
    expect(webView.reviews[0]?.schoolName).toBeNull();
  });

  it('renders the skill the API resolved in `skills`, and its absence as "not provided"', () => {
    const withSkills = mapContractDetailToWeb({
      ...sampleContractDetail,
      skills: [
        {
          id: 'skill-ds-1',
          name: 'Data structures',
          category: 'Programming',
          levels: ['beginner', 'intermediate', 'advanced'],
        },
      ],
    });
    expect(withSkills.skillName).toBe('Data structures');
    expect(withSkills.skillCategory).toBe('programming');
    // The lowest advertised level is shown, exactly as the list page does.
    expect(withSkills.level).toBe('beginner');

    // `skills` is optional: a failed catalogue read leaves the field off the
    // response, and the page says so instead of guessing a skill.
    expect(sampleContractDetail.skills).toBeUndefined();
    const withoutSkills = mapContractDetailToWeb(sampleContractDetail);
    expect(withoutSkills.skillName).toBeNull();
    expect(withoutSkills.skillCategory).toBeNull();
    expect(withoutSkills.level).toBeNull();
  });

  it('keeps a real rating and does not coerce an absent one to 5.0', () => {
    expect(mapContractDetailToWeb(sampleContractDetail).ratingAvg).toBe(4.9);

    const unrated = mapContractDetailToWeb({
      ...sampleContractDetail,
      teacher: { ...sampleContractDetail.teacher, averageRating: null, ratingsCount: 0 },
      recentRatings: [],
    });
    // The old mapper wrote `?? 5.0`, turning "no ratings" into a perfect score.
    expect(unrated.ratingAvg).toBeNull();
    expect(unrated.ratingCount).toBe(0);
  });

  it('threads the booking verdict the API gives this caller, inventing nothing', () => {
    // Route 14 is the only route that answers *for this caller*: the verdict
    // and any hold are copied across unchanged, because the booking action
    // below refuses, reuses a seat and names its disabled reason from them.
    const withHold = mapContractDetailToWeb({
      ...sampleContractDetail,
      canBook: false,
      ownBooking: { bookingId: 'booking-1', state: 'pending', expiresAt: '2026-10-30T10:15:00.000Z' },
    });
    expect(withHold.canBook).toBe(false);
    expect(withHold.availableSeats).toBe(2);
    expect(withHold.ownBooking).toMatchObject({ bookingId: 'booking-1', state: 'pending' });

    // No hold in the response means no hold — never a fabricated one — and
    // `canBook` is whatever the server said, not an optimistic default.
    const withoutHold = mapContractDetailToWeb(sampleContractDetail);
    expect(withoutHold.canBook).toBe(true);
    expect(withoutHold.ownBooking).toBeNull();
    expect(withoutHold.availableSeats).toBe(2);
  });

  it('resolves demo class IDs seamlessly from fallback fixture', async () => {
    const gateway = new ClassDetailApiGateway();
    const item = await gateway.getById('demo-ielts-speaking');
    expect(item).not.toBeNull();
    expect(item?.id).toBe('demo-ielts-speaking');
  });

  it('returns null when id does not exist in backend or fallback', async () => {
    const gateway = new ClassDetailApiGateway();
    const item = await gateway.getById('non-existent-random-id');
    expect(item).toBeNull();
  });
});
