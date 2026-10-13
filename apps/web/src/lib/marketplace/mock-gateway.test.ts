import { describe, expect, it } from 'vitest';
import { MockMarketplaceGateway } from './mock-gateway';
import { DEFAULT_QUERY } from './types';

describe('MockMarketplaceGateway', () => {
  it('returns the first page with six demo classes by default', async () => {
    const gateway = new MockMarketplaceGateway();
    const result = await gateway.search(DEFAULT_QUERY);
    expect(result.items).toHaveLength(6);
    expect(result.total).toBe(6);
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(6);
  });

  it('filters by keyword (case-insensitive across skill and teacher)', async () => {
    const gateway = new MockMarketplaceGateway();
    const result = await gateway.search({ ...DEFAULT_QUERY, keyword: 'ielts' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.skillName).toMatch(/ielts/i);
  });

  it('filters by category', async () => {
    const gateway = new MockMarketplaceGateway();
    const result = await gateway.search({
      ...DEFAULT_QUERY,
      category: 'programming',
    });
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(item.skillCategory).toBe('programming');
    }
  });

  it('filters by format when only 1-1 is requested', async () => {
    const gateway = new MockMarketplaceGateway();
    const result = await gateway.search({
      ...DEFAULT_QUERY,
      formats: ['one-on-one'],
    });
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(item.format).toBe('one-on-one');
    }
  });

  it('sorts by price ascending', async () => {
    const gateway = new MockMarketplaceGateway();
    const result = await gateway.search({ ...DEFAULT_QUERY, sort: 'price-low' });
    const prices = result.items.map((item) => item.priceCredits);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('sorts by rating descending', async () => {
    const gateway = new MockMarketplaceGateway();
    const result = await gateway.search({ ...DEFAULT_QUERY, sort: 'rating' });
    const ratings = result.items.map((item) => item.ratingAvg);
    expect(ratings).toEqual([...ratings].sort((a, b) => (b ?? -1) - (a ?? -1)));
  });

  it('returns an empty page when no class matches the filter', async () => {
    const gateway = new MockMarketplaceGateway();
    const result = await gateway.search({
      ...DEFAULT_QUERY,
      keyword: 'definitely-not-a-real-skill',
    });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('respects pagination (perPage + page)', async () => {
    const gateway = new MockMarketplaceGateway();
    const firstPage = await gateway.search({
      ...DEFAULT_QUERY,
      perPage: 3,
      page: 1,
    });
    const secondPage = await gateway.search({
      ...DEFAULT_QUERY,
      perPage: 3,
      page: 2,
    });
    expect(firstPage.items).toHaveLength(3);
    expect(secondPage.items).toHaveLength(3);
    const firstIds = firstPage.items.map((item) => item.id);
    const secondIds = secondPage.items.map((item) => item.id);
    expect(firstIds).not.toEqual(secondIds);
  });
});
