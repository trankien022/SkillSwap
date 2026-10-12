import type { VerifierView } from '@skillswap/contracts';
import { assertVerifierTransition, UnknownVerifierError } from '../domain/verifier';
import type { VerifierRepository } from './port/out/skill-evidence-repository';
import type {
  ChangeVerifierStatusCommand,
  ChangeVerifierStatusPort,
} from './port/in/change-verifier-status';
import { toVerifierView } from './verifier-view';

/**
 * FR-004 / ADR-027: an Administrator suspends, revokes, or reactivates a Verifier.
 * Callers are gated to the `admin` role at the web boundary.
 */
export class ChangeVerifierStatusUseCase implements ChangeVerifierStatusPort {
  constructor(private readonly verifiers: VerifierRepository) {}

  async execute(command: ChangeVerifierStatusCommand): Promise<VerifierView> {
    const current = await this.verifiers.findById(command.verifierId);
    if (current === null) {
      throw new UnknownVerifierError(command.verifierId);
    }
    assertVerifierTransition(current.status, command.status);
    const updated = await this.verifiers.setStatus(command.verifierId, command.status);
    if (updated === null) {
      throw new UnknownVerifierError(command.verifierId);
    }
    return toVerifierView(updated);
  }
}
