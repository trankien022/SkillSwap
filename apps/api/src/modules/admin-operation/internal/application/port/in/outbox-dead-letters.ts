import type {
  OutboxDeadLetterPage,
  OutboxDeadLetterQueryInput,
  ReplayDeadLetterRequestInput,
  ReplayDeadLetterResultView,
} from '@skillswap/contracts';

export const LIST_OUTBOX_DEAD_LETTERS = Symbol('ListOutboxDeadLetters');
export const REPLAY_OUTBOX_DEAD_LETTER = Symbol('ReplayOutboxDeadLetter');

/**
 * FR-015 / ADR-013 Amendment A (W2 C3): reading the dead-letter inbox.
 *
 * Authorization is the controller's (`@Roles('admin')`), as with the audit log: there is no
 * per-module dead-letter queue a module owner may read, because a dead letter is
 * infrastructure state (ADR-013), not domain state.
 */
export interface ListOutboxDeadLettersPort {
  /**
   * `offset` is the decoded page cursor. The adapter decodes it because the cursor format and
   * its malformed-cursor error are wire concerns this layer may not import (ADR-009).
   */
  execute(
    query: OutboxDeadLetterQueryInput,
    offset: number,
  ): Promise<OutboxDeadLetterPage & { readonly hasMore: boolean }>;
}

/**
 * FR-015 / ADR-013 Amendment A (W2 C3, decided 2026-10-25): replay one dead letter.
 *
 * `actorId` is the Administrator performing the replay and is required: the decision was
 * *audited*, single-row, Administrator-only, so the caller identity is part of the contract
 * rather than something the adapter guesses.
 */
export interface ReplayOutboxDeadLetterPort {
  execute(
    request: ReplayDeadLetterRequestInput,
    actorId: string,
  ): Promise<ReplayDeadLetterResultView>;
}
