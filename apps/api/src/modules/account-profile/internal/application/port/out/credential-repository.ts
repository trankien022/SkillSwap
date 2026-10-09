import type { PasswordHash } from '../../../domain/credential';

export const CREDENTIAL_REPOSITORY = Symbol('CredentialRepository');

export interface CredentialRepository {
  save(accountId: string, hash: PasswordHash): Promise<void>;
  findByAccountId(accountId: string): Promise<PasswordHash | null>;
}
