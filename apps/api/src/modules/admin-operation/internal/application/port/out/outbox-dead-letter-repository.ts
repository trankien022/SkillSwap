import type { OutboxDeadLetterView } from '@skillswap/contracts';

export const OUTBOX_DEAD_LETTER_REPOSITORY = Symbol('OutboxDeadLetterRepository');

/**
 * FR-015 / ADR-013 Amendment A (W2 C3, decided 2026-10-25).
 *
 * A dead letter is an event the relay proved it cannot ever publish: the payload failed
 * validation. Listing is a read; replay is a privileged write and is audited by its caller.
 */

/** One page of dead letters across all module schemas, newest failure first. */
export interface OutboxDeadLetterPage {
  readonly items: OutboxDeadLetterView[];
  /**
   * Whether more rows exist past this page.
   *
   * Not a keyset cursor, because the ordering spans seven schemas that cannot be joined
   * (ADR-014); the cursor is an offset, and the port is where that is made explicit rather
   * than leaking into the wire contract.
   */
  readonly hasMore: boolean;
}

export interface OutboxDeadLetterQuery {
  readonly limit: number;
  /** Decoded from the opaque cursor by the query handler. */
  readonly offset: number;
  readonly module?: string;
  readonly eventType?: string;
}

/**
 * What a replay did.
 *
 * `replayed: false` with the row's current status covers the honest cases — a double click,
 * or a row that a concurrent replay already picked up — and is not an error.
 */
export interface ReplayOutboxResult {
  readonly replayed: boolean;
  readonly status: 'PENDING' | 'PUBLISHED' | 'DEAD';
}

export interface OutboxDeadLetterRepository {
  list(query: OutboxDeadLetterQuery): Promise<OutboxDeadLetterPage>;
  /** ADR-013 Amendment A: how many dead letters match, across every module schema. */
  count(query: Omit<OutboxDeadLetterQuery, 'limit' | 'offset'>): Promise<number>;
  replay(moduleName: string, id: string): Promise<ReplayOutboxResult>;
}
