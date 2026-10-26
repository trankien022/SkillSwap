import { AccountNotFoundError, assertSuspensionReason, InvalidReactivationReasonError } from '../domain/account';
import type { AccountLockRepository } from './port/out/account-repository';
import type { LockAccountCommand, LockAccountPort, LockAccountResult } from './port/in/lock-account';

/**
 * FR-015 / OQ-015 / ADR-037: suspend or reactivate an account.
 *
 * Callers are gated to the `admin` role at the web boundary (AC-033), and this use case does not
 * repeat that check — a role check here would be a second, weaker copy of the guard that already
 * runs before the request reaches the application layer.
 *
 * **Nothing is automatic** (ADR-037 decision 3, C-010): this is only ever invoked by an
 * Administrator. There is no threshold, no sweep, and no event that triggers a suspension.
 */
export class LockAccountUseCase implements LockAccountPort {
  constructor(
    private readonly accounts: AccountLockRepository,
    private readonly clock: { now(): Date } = { now: () => new Date() },
  ) {}

  async execute(command: LockAccountCommand): Promise<LockAccountResult> {
    const suspending = command.status === 'suspended';
    // ADR-037 decision 2: the reason is required to suspend and meaningless to reactivate, so it is
    // rejected rather than silently ignored — an ignored field is how a caller comes to believe it
    // recorded something it did not.
    if (suspending) {
      assertSuspensionReason(command.reason ?? '');
    } else if (command.reason !== null && command.reason.trim() !== '') {
      throw new InvalidReactivationReasonError();
    }

    const updated = await this.accounts.changeStatus({
      accountId: command.accountId,
      status: command.status,
      reason: suspending ? (command.reason as string).trim() : null,
      actorId: command.actorId,
      occurredAt: this.clock.now(),
    });
    if (updated === null) {
      throw new AccountNotFoundError(command.accountId);
    }

    return {
      accountId: updated.account.id,
      status: updated.account.status,
      // A repeat of the same status writes nothing and emits no event, so the caller can tell a
      // real change from a no-op instead of assuming success means "it happened now".
      changed: updated.changed,
      reason: updated.account.suspension?.reason ?? null,
    };
  }
}
