import { describe, expect, it } from 'vitest';
import { MarketplaceApiGateway, mapClassListItemToMarketplace } from './api-gateway';
import { DEFAULT_QUERY } from './mock-gateway';
import type { ClassListItemView } from '@skillswap/contracts';

describe('MarketplaceApiGateway', () => {
  const sampleItem: ClassListItemView = {
    id: 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6',
    teacherId: 'teacher-123',
    teacherDisplayName: 'Trần Văn A',
    skillIds: ['skill-prog-1'],
    description: 'Lập trình Go căn bản cho người mới bắt đầu',
    startsAt: '2026-10-20T10:00:00.000Z',
    durationMinutes: 90,
    priceCredits: 50,
    capacity: 1,
    confirmedBookingsCount: 0,
    availableSeats: 1,
    state: 'published',
    averageRating: 4.8,
    ratingsCount: 12,
  };

  it('maps backend ClassListItemView into MarketplaceClass presentation structure', () => {
    const mapped = mapClassListItemToMarketplace(sampleItem);
    expect(mapped.id).toBe(sampleItem.id);
    expect(mapped.teacherName).toBe('Trần Văn A');
    expect(mapped.priceCredits).toBe(50);
    expect(mapped.format).toBe('one-on-one');
    expect(mapped.ratingAvg).toBe(4.8);
    expect(mapped.ratingCount).toBe(12);
    expect(mapped.verified).toBe(true);
  });

  it('falls back to mock catalogue when network fails or user is unauthenticated', async () => {
    const gateway = new MarketplaceApiGateway();
    // Default fetch will fail in vitest environment without global mock or 401
    const result = await gateway.search(DEFAULT_QUERY);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.page).toBe(1);
  });
});
