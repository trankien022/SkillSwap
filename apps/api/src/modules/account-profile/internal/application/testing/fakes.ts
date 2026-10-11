import type { AccountVerificationStatus } from '@skillswap/contracts';
import type { Account } from '../../domain/account';
import type { PasswordHash } from '../../domain/credential';
import type { Session } from '../../domain/session';
import type { AccountRepository, NewAccount } from '../port/out/account-repository';
import type { CredentialRepository } from '../port/out/credential-repository';
import type { SessionRepository, NewSession } from '../port/out/session-repository';
import type { PasswordHasher } from '../port/out/password-hasher';
import type { AccessTokenInput, IssuedAccessToken, TokenService } from '../port/out/token-service';
import type {
  ProjectedVerificationStatus,
  UpsertVerificationStatusRequest,
  VerificationStatusReader,
  VerificationStatusWriter,
} from '../port/out/verification-status-projector';

export class FakeAccountRepository implements AccountRepository {
  private readonly byEmail = new Map<string, Account>();
  private seq = 0;

  async create(input: NewAccount): Promise<Account> {
    this.seq += 1;
    const account: Account = {
      id: `acct-${this.seq}`,
      email: input.email.trim().toLowerCase(),
      displayName: input.displayName,
      role: input.role,
      status: input.status,
      createdAt: '2026-10-09T00:00:00.000Z',
    };
    this.byEmail.set(account.email, account);
    return account;
  }

  async findByEmail(email: string): Promise<Account | null> {
    return this.byEmail.get(email.trim().toLowerCase()) ?? null;
  }

  async findById(id: string): Promise<Account | null> {
    for (const account of this.byEmail.values()) {
      if (account.id === id) return account;
    }
    return null;
  }
}

/** Deterministic hash: "hash:<plaintext>" — good enough for use-case tests. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(plaintext: string): Promise<PasswordHash> {
    return { algorithm: 'scrypt', salt: 'salt', hash: `hash:${plaintext}`, keyLength: 64 };
  }

  async verify(plaintext: string, stored: PasswordHash): Promise<boolean> {
    return stored.hash === `hash:${plaintext}`;
  }
}

export class FakeCredentialRepository implements CredentialRepository {
  private readonly byAccount = new Map<string, PasswordHash>();

  async save(accountId: string, hash: PasswordHash): Promise<void> {
    this.byAccount.set(accountId, hash);
  }

  async findByAccountId(accountId: string): Promise<PasswordHash | null> {
    return this.byAccount.get(accountId) ?? null;
  }
}

export class FakeSessionRepository implements SessionRepository {
  readonly sessions = new Map<string, Session>();
  seq = 0;

  async create(input: NewSession): Promise<Session> {
    this.seq += 1;
    const session: Session = {
      id: `sess-${this.seq}`,
      accountId: input.accountId,
      refreshTokenHash: input.refreshTokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      createdAt: '2026-10-09T00:00:00.000Z',
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async findByTokenHash(refreshTokenHash: string): Promise<Session | null> {
    for (const session of this.sessions.values()) {
      if (session.refreshTokenHash === refreshTokenHash) return session;
    }
    return null;
  }

  async revoke(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session !== undefined && session.revokedAt === null) {
      this.sessions.set(id, { ...session, revokedAt: '2026-10-09T00:05:00.000Z' });
    }
  }

  async revokeAllForAccount(accountId: string): Promise<void> {
    for (const [id, session] of this.sessions) {
      if (session.accountId === accountId) await this.revoke(id);
    }
  }
}

export class FakeTokenService implements TokenService {
  seq = 0;

  issueAccessToken(input: AccessTokenInput): IssuedAccessToken {
    return { token: `access:${input.accountId}`, expiresInSeconds: 900 };
  }

  newRefreshToken(): string {
    this.seq += 1;
    return `issued-refresh-${this.seq}`;
  }

  hashRefreshToken(raw: string): string {
    return `sha256:${raw}`;
  }
}

export class FakeClock {
  constructor(private current: Date = new Date('2026-10-09T00:00:00.000Z')) {}
  now(): Date {
    return this.current;
  }
  set(date: Date): void {
    this.current = date;
  }
}

/** In-memory FR-017 verification-status projection (reader + writer). */
export class FakeVerificationStatusProjector
  implements VerificationStatusReader, VerificationStatusWriter
{
  private readonly rows = new Map<
    string,
    { status: AccountVerificationStatus; reason: string | null; occurredAt: string }
  >();

  async findByAccount(accountId: string): Promise<ProjectedVerificationStatus | null> {
    const row = this.rows.get(accountId);
    return row === undefined ? null : { status: row.status, reason: row.reason };
  }

  async upsert(request: UpsertVerificationStatusRequest): Promise<void> {
    const existing = this.rows.get(request.accountId);
    if (existing !== undefined && existing.occurredAt >= request.occurredAt) {
      return;
    }
    this.rows.set(request.accountId, {
      status: request.status,
      reason: request.reason,
      occurredAt: request.occurredAt,
    });
  }
}

