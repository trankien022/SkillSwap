import type { VerifierView } from '@skillswap/contracts';

export const CHANGE_VERIFIER_STATUS = Symbol('ChangeVerifierStatus');

/** FR-004 / ADR-027: an Administrator suspends/revokes/reactivates a Verifier. */
export interface ChangeVerifierStatusCommand {
  verifierId: string;
  status: 'active' | 'suspended' | 'revoked';
  /**
   * ADR-035: the Administrator performing the change. Required, not optional — the audited event
   * records an act by a person, and `SYSTEM_ACTOR_ID` is reserved for actions nobody took.
   */
  actorId: string;
}

export interface ChangeVerifierStatusPort {
  execute(command: ChangeVerifierStatusCommand): Promise<VerifierView>;
}
