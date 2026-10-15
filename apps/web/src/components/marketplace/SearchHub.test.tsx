import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../messages/en.json';
import { DEFAULT_QUERY, type MarketplaceQuery } from '../../lib/marketplace/types';
import { SearchHub } from './SearchHub';

afterEach(cleanup);
function view(query: MarketplaceQuery, onSubmit = vi.fn()) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <SearchHub
        initialQuery={query}
        onSubmit={onSubmit}
        filterOpen={false}
        onToggleFilters={vi.fn()}
      />
    </NextIntlClientProvider>
  );
}
describe('marketplace search controls', () => {
  it('returns to the first page when starting a new search', () => {
    const onSubmit = vi.fn();
    render(view({ ...DEFAULT_QUERY, page: 4 }, onSubmit));
    fireEvent.change(screen.getByRole('textbox', { name: en.Marketplace.search.keywordLabel }), {
      target: { value: 'React' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.Marketplace.search.submitButton }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'React', page: 1 }));
  });
  it('clears visible fields when filters are reset by the parent', () => {
    const { rerender } = render(
      view({ ...DEFAULT_QUERY, keyword: 'React', university: 'bk' }),
    );
    rerender(view({ ...DEFAULT_QUERY }));
    expect(
      (screen.getByRole('textbox', { name: en.Marketplace.search.keywordLabel }) as HTMLInputElement).value,
    ).toBe('');
    expect(
      (screen.getByLabelText(en.Marketplace.search.universityLabel) as HTMLSelectElement).value,
    ).toBe('all');
  });
});
