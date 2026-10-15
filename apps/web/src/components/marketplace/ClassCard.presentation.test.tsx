import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import { demoMarketplaceClasses } from '../../lib/marketplace/mock-data';
import { ClassCard } from './ClassCard';
afterEach(cleanup);
describe('class price and seat presentation', () => {
  it('shows the actual free seats and does not divide a learner price by capacity', () => {
    const item = {
      ...demoMarketplaceClasses()[0]!,
      priceCredits: 50,
      capacity: 2,
      format: 'group-2-4' as const,
      availableSeats: 1,
    };
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ClassCard item={item} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('1/2 seats available')).toBeTruthy();
    expect(screen.getByText(/50,000/)).toBeTruthy();
    expect(screen.queryByText(/25,000/)).toBeNull();
  });
  it('states when the API has not supplied seat availability', () => {
    const item = { ...demoMarketplaceClasses()[0]!, availableSeats: null };
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ClassCard item={item} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(en.Marketplace.card.availabilityUnknown)).toBeTruthy();
  });
});
