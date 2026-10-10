import { GetWalletHistoryQueryHandler } from './get-wallet-history.query';
import { DEFAULT_HISTORY_LIMIT } from './port/in/get-wallet-history';
import { FakeWalletReader } from './testing/fakes';
import type { WalletHistoryItemView } from '@skillswap/contracts';

function item(partial: Partial<WalletHistoryItemView>): WalletHistoryItemView {
  return {
    id: '1',
    type: 'top_up',
    direction: 'credit',
    amountCredits: 100,
    status: 'completed',
    reference: null,
    createdAt: '2026-10-12T10:00:00.000Z',
    ...partial,
  };
}

describe('GetWalletHistoryQueryHandler (FR-010 / ADR-022)', () => {
  it('reads only the owner\'s entries, newest first', async () => {
    const reader = new FakeWalletReader();
    reader.seed('u1', [item({ id: '3' }), item({ id: '2' }), item({ id: '1' })]);
    reader.seed('u2', [item({ id: 'x', amountCredits: 999 })]);
    const handler = new GetWalletHistoryQueryHandler(reader);
    const page = await handler.execute({ ownerId: 'u1' });
    expect(page.items.map((i) => i.id)).toEqual(['3', '2', '1']);
  });

  it('paginates with a cursor and reports the next cursor', async () => {
    const reader = new FakeWalletReader();
    reader.seed(
      'u1',
      Array.from({ length: 5 }, (_, i) => item({ id: String(5 - i) })),
    );
    const handler = new GetWalletHistoryQueryHandler(reader);
    const first = await handler.execute({ ownerId: 'u1', limit: 2 });
    expect(first.items.map((i) => i.id)).toEqual(['5', '4']);
    expect(first.nextCursor).toBe('2');
    const second = await handler.execute({ ownerId: 'u1', limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((i) => i.id)).toEqual(['3', '2']);
  });

  it('defaults the page size', async () => {
    const reader = new FakeWalletReader();
    reader.seed('u1', []);
    const handler = new GetWalletHistoryQueryHandler(reader);
    const spy = jest.spyOn(reader, 'history');
    await handler.execute({ ownerId: 'u1' });
    expect(spy).toHaveBeenCalledWith({ ownerId: 'u1', limit: DEFAULT_HISTORY_LIMIT, cursor: undefined });
  });

  it('returns reversed entries as reversed, never completed (AC)', async () => {
    const reader = new FakeWalletReader();
    reader.seed('u1', [item({ id: 'r', type: 'refund', direction: 'debit', status: 'reversed' })]);
    const handler = new GetWalletHistoryQueryHandler(reader);
    const page = await handler.execute({ ownerId: 'u1' });
    expect(page.items[0].status).toBe('reversed');
  });

  it('reconciles: credits minus debits is the owner balance', async () => {
    const reader = new FakeWalletReader();
    reader.seed('u1', [
      item({ id: '1', direction: 'credit', amountCredits: 100 }),
      item({ id: '2', direction: 'credit', amountCredits: 50 }),
      item({ id: '3', direction: 'debit', amountCredits: 30 }),
    ]);
    const { credits, debits } = await reader.sums('u1');
    expect(credits - debits).toBe(120);
  });
});
