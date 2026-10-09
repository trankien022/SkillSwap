import type { Account, AccountRole, AccountStatus } from '../../../domain/account';

export const ACCOUNT_REPOSITORY = Symbol('AccountRepository');

export interface NewAccount {
  readonly email: string;
  readonly displayName: string;
  readonly role: AccountRole;
  readonly status: AccountStatus;
}

export interface AccountRepository {
  create(input: NewAccount): Promise<Account>;
  findByEmail(email: string): Promise<Account | null>;
  findById(id: string): Promise<Account | null>;
}

export type { Account };
