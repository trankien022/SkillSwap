import {
  DEFAULT_PAGE_LIMIT,
  type OutboxDeadLetterPage,
  type OutboxDeadLetterQueryInput,
} from '@skillswap/contracts';
import type { ListOutboxDeadLettersPort } from '../port/in/outbox-dead-letters';
import type { OutboxDeadLetterRepository } from '../port/out/outbox-dead-letter-repository';

/**
 * FR-015 / ADR-013 Amendment A (W2 C3): the dead-letter inbox, newest first.
 *
 * This handler decides *what* to ask for — the page default and the filter pass-through — and
 * nothing else. Cursor encoding and the `InvalidCursorError` a malformed cursor raises belong
 * to the HTTP adapter, because they are wire concerns and the application layer may not depend
 * on `shared` (ADR-009). The adapter passes a decoded offset in, so this file stays free of
 * both the cursor format and the error type.
 *
 * The paged envelope returned here uses the repository's `hasMore` only to know whether a next
 * page exists; the adapter turns that into the opaque cursor.
 */
export class ListOutboxDeadLettersQueryHandler implements ListOutboxDeadLettersPort {
  constructor(private readonly deadLetters: OutboxDeadLetterRepository) {}

  async execute(
    query: OutboxDeadLetterQueryInput,
    offset: number,
  ): Promise<OutboxDeadLetterPage & { readonly hasMore: boolean }> {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const filter = { module: query.module, eventType: query.eventType };

    const [page, total] = await Promise.all([
      this.deadLetters.list({ limit, offset, ...filter }),
      this.deadLetters.count(filter),
    ]);

    return {
      items: page.items,
      hasMore: page.hasMore,
      page: { limit, nextCursor: null, total },
    };
  }
}
