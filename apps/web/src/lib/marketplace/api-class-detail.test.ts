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
    expect(webView.skillName).toBeNull();
    expect(webView.skillCategory).toBeNull();
    expect(webView.level).toBeNull();
    expect(webView.verified).toBeNull();
    // The reviewer's school is not returned, so none is claimed.
    expect(webView.reviews[0]?.schoolName).toBeNull();
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
