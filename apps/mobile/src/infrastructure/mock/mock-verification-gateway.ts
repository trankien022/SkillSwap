import type { VerificationGateway, VerificationData } from '@/application/port/verification-gateway';
import { verificationSuccess } from './verification-mock';

/**
 * Simple mock adapter returning the verification mock data. Matches the
 * verification-gateway port so the UI and service remain unchanged if a
 * real HTTP adapter is later provided.
 */
export class MockVerificationGateway implements VerificationGateway {
  constructor(private readonly payload: VerificationData = verificationSuccess) {}

  async loadVerification(): Promise<VerificationData> {
    // Simulate a small delay to allow UI skeletons to render
    await new Promise((r) => setTimeout(r, 120));
    return this.payload;
  }
}
