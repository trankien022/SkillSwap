import { filterMarketplaceItems } from './marketplace-filters';
import type { ClassListItemView } from '@skillswap/contracts';

const sample = (id: string, overrides: Partial<ClassListItemView> = {}): ClassListItemView => ({
  id, teacherId: 'teacher', teacherDisplayName: 'Teacher', verified: true, schoolName: 'Uni', skillIds: [],
  title: id, level: null, format: 'one-on-one', description: id, startsAt: '2026-12-10T10:00:00.000Z',
  durationMinutes: 60, priceCredits: 10, capacity: 1, confirmedBookingsCount: 0, availableSeats: 1,
  state: 'published', averageRating: 4.5, ratingsCount: 1, ...overrides,
});

describe('marketplace client refinements', () => {
  const rows = [sample('low', { priceCredits: 8 }), sample('group', { format: 'group', verified: false }), sample('unrated', { averageRating: null })];
  it('combines format, verification, price and rating without inventing server query fields', () => {
    expect(filterMarketplaceItems(rows, { format: 'one-on-one', verified: 'yes', maxPrice: '9', minRating: '4', category: 'all', school: '', skillCategories: new Map() }).map((row) => row.id)).toEqual(['low']);
  });
  it('excludes null ratings from a minimum rating and ignores invalid numeric filters safely', () => {
    expect(filterMarketplaceItems(rows, { format: 'all', verified: 'all', maxPrice: '', minRating: '4', category: 'all', school: '', skillCategories: new Map() }).map((row) => row.id)).toEqual(['low', 'group']);
    expect(filterMarketplaceItems(rows, { format: 'all', verified: 'all', maxPrice: 'bad', minRating: '', category: 'all', school: '', skillCategories: new Map() })).toEqual([]);
  });
});
