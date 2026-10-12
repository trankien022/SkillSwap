import type { VerifierView } from '@skillswap/contracts';

export const CHANGE_VERIFIER_STATUS = Symbol('ChangeVerifierStatus');

/** FR-004 / ADR-027: an Administrator suspends/revokes/reactivates a Verifier. */
export interface ChangeVerifierStatusCommand {
  verifierId: string;
  status: 'active' | 'suspended' | 'revoked';
}

export interface ChangeVerifierStatusPort {
  execute(command: ChangeVerifierStatusCommand): Promise<VerifierView>;
}
