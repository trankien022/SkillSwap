import type { VerificationGateway, VerificationData } from './port/verification-gateway';

export class VerificationService {
  constructor(private readonly gateway: VerificationGateway) {}

  load(): Promise<VerificationData> {
    return this.gateway.loadVerification();
  }
}
