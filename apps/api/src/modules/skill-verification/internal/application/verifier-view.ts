import type { VerifierView } from '@skillswap/contracts';
import type { VerifierRecord } from './port/out/skill-evidence-repository';

/** Maps a verifier record to the API view (FR-004 / ADR-027). */
export function toVerifierView(verifier: VerifierRecord): VerifierView {
  return {
    accountId: verifier.accountId,
    status: verifier.status,
    expertise: [...verifier.expertise],
  };
}
