import {
  InactiveVerifierError,
  OutOfExpertiseError,
  UnknownVerifierError,
  hasExpertise,
  type Verifier,
} from '../domain/verifier';
import type { VerifierRepository } from './port/out/skill-evidence-repository';

/**
 * FR-004 / ADR-027: loads a Verifier and enforces the authority clauses that apply
 * to visibility/claiming: the account must be a known Verifier, `active`, and hold
 * expertise for the skill. The self-decision clause (BR-012) is enforced separately
 * because it needs the evidence owner.
 */
export class VerifierAuthority {
  constructor(private readonly verifiers: VerifierRepository) {}

  /** Loads an active Verifier and asserts expertise for `skillId`. */
  async requireExpertise(verifierId: string, skillId: string): Promise<Verifier> {
    const verifier = await this.verifiers.findById(verifierId);
    if (verifier === null) {
      throw new UnknownVerifierError(verifierId);
    }
    if (verifier.status !== 'active') {
      throw new InactiveVerifierError(verifierId, verifier.status);
    }
    if (!hasExpertise(verifier, skillId)) {
      throw new OutOfExpertiseError(verifierId, skillId);
    }
    return verifier;
  }
}
