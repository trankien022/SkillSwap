import { ListOutboxDeadLettersQueryHandler } from './list-outbox-dead-letters.query';
import type { OutboxDeadLetterRepository } from '../port/out/outbox-dead-letter-repository';

/**
 * FR-015 / ADR-013 Amendment A (W2 C3): the dead-letter page.
 *
 * Two properties are pinned: `total` is the real backlog count rather than the page length
 * (an Administrator must be able to tell "three" from "at least three"), and a next-page
 * signal only appears when there really is more to read.
 */

function createHarness(hasMore: boolean, total: number) {
  const list = jest.fn(async () => ({ items: [{ id: 'a' }], hasMore }));
  const count = jest.fn(async () => total);

  const repository = { list, count } as unknown as OutboxDeadLetterRepository;
  return { handler: new ListOutboxDeadLettersQueryHandler(repository), list, count };
}

describe('ListOutboxDeadLettersQueryHandler (ADR-013 Amendment A, W2 C3)', () => {
  it('passes the offset and filters straight through, with the default page size', async () => {
    const harness = createHarness(false, 1);

    const page = await harness.handler.execute({ module: 'live-class' }, 40);

    expect(harness.list).toHaveBeenCalledWith({
      limit: 20,
      offset: 40,
      module: 'live-class',
      eventType: undefined,
    });
    expect(harness.count).toHaveBeenCalledWith({
      module: 'live-class',
      eventType: undefined,
    });
    expect(page.page.limit).toBe(20);
  });

  it('reports the real backlog in total, not the length of this page', async () => {
    const harness = createHarness(true, 12);

    const page = await harness.handler.execute({}, 0);

    expect(page.items).toHaveLength(1);
    expect(page.page.total).toBe(12);
    expect(page.hasMore).toBe(true);
    // The cursor itself is the adapter's job; this layer never invents one.
    expect(page.page.nextCursor).toBeNull();
  });

  it('does not signal more pages when the merge says there are none', async () => {
    const harness = createHarness(false, 1);

    const page = await harness.handler.execute({}, 0);

    expect(page.hasMore).toBe(false);
  });
});
