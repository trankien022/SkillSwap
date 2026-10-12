import type { VerifierQueuePage } from '@skillswap/contracts';

export const LIST_VERIFIER_QUEUE = Symbol('ListVerifierQueue');

/** FR-004 / NFR-014: filters, sort and page window for the verifier queue. */
export interface ListVerifierQueueRequest {
  readonly verifierId: string;
  readonly limit?: number;
  readonly cursor?: string;
  readonly level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  readonly type?: 'certificate' | 'verifier_assessment';
  readonly q?: string;
  readonly sort?: 'submittedAt' | '-submittedAt';
}

/** FR-004 / ADR-027: the expertise-scoped pending queue for a Verifier. */
export interface ListVerifierQueuePort {
  execute(request: ListVerifierQueueRequest): Promise<VerifierQueuePage>;
}

export const DEFAULT_QUEUE_LIMIT = 20;
