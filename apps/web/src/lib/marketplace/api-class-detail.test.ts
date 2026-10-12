import { describe, expect, it } from 'vitest';
import { ClassDetailApiGateway, mapContractDetailToWeb, mapCreatedClassToDetail } from './api-class-detail';
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

  it('maps backend ClassDetailView contract to web presentation view', () => {
    const webView = mapContractDetailToWeb(sampleContractDetail);
    expect(webView.id).toBe(sampleContractDetail.id);
    expect(webView.teacherName).toBe('Lê Minh');
    expect(webView.priceCredits).toBe(80);
    expect(webView.format).toBe('group-2-4');
    expect(webView.reviews).toHaveLength(1);
    expect(webView.reviews[0]?.authorName).toBe('Học viên A');
    expect(webView.syllabus.length).toBeGreaterThan(0);
    expect(webView.prerequisites.length).toBeGreaterThan(0);
  });

  it('maps locally stored created class to complete ClassDetailView', () => {
    const local = {
      id: 'cls-demo-56h3hb',
      title: 'Luyện đề IELTS Speaking cấp tốc',
      skillName: 'IELTS Speaking',
      description: 'Luyện nói 1-1 phản xạ cùng cựu học sinh chuyên Anh.',
      startsAt: '2026-10-28T10:00:00.000Z',
      durationMinutes: 60,
      priceCredits: 50,
      capacity: 1,
    };
    const detail = mapCreatedClassToDetail(local);
    expect(detail.id).toBe('cls-demo-56h3hb');
    expect(detail.skillName).toBe('IELTS Speaking');
    expect(detail.description).toBe('Luyện nói 1-1 phản xạ cùng cựu học sinh chuyên Anh.');
    expect(detail.format).toBe('one-on-one');
    expect(detail.priceCredits).toBe(50);
    expect(detail.syllabus.length).toBe(3);
    expect(detail.prerequisites.length).toBe(2);
    expect(detail.teacherCredentials.length).toBeGreaterThanOrEqual(1);
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
