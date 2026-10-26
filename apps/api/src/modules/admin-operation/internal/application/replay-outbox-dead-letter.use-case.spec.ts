import { ReplayOutboxDeadLetterUseCase, REPLAY_ACTION } from './replay-outbox-dead-letter.use-case';
import type { AdminAuditEventRepository } from './port/out/admin-audit-event-repository';
import type { OutboxDeadLetterRepository } from './port/out/outbox-dead-letter-repository';

/**
 * FR-015 / ADR-013 Amendment A (W2 C3, decided 2026-10-25): replay is Administrator-only,
 * single-row and audited.
 *
 * The property that matters is the pairing: **one** successful replay writes **exactly one**
 * audit row, and a replay that moved nothing writes none. Logging a no-op would make the audit
 * log claim work that did not happen.
 */

function createHarness(
  replayResult: { replayed: boolean; status: 'PENDING' | 'PUBLISHED' | 'DEAD' },
) {
  const replay = jest.fn(async (_module: string, _id: string) => replayResult);
  const append = jest.fn(async (_input: unknown) => true);

  const deadLetters = { replay } as unknown as OutboxDeadLetterRepository;
  const audit = { append } as unknown as AdminAuditEventRepository;

  return {
    useCase: new ReplayOutboxDeadLetterUseCase(deadLetters, audit),
    replay,
    append,
  };
}

describe('ReplayOutboxDeadLetterUseCase (ADR-013 Amendment A, W2 C3)', () => {
  it('writes exactly one audit row naming the Administrator who replayed', async () => {
    const harness = createHarness({ replayed: true, status: 'PENDING' });

    const result = await harness.useCase.execute(
      { module: 'live-class', id: '11111111-1111-4111-8111-111111111111' },
      'admin-1',
    );

    expect(result).toEqual({ replayed: true, status: 'PENDING' });
    expect(harness.append).toHaveBeenCalledTimes(1);
    const input = harness.append.mock.calls.at(0)?.at(0) as Record<string, unknown> | undefined;
    expect(input).toMatchObject({
      actorId: 'admin-1',
      action: REPLAY_ACTION,
      targetType: 'outbox_message',
      targetId: '11111111-1111-4111-8111-111111111111',
      oldState: { module: 'live-class', status: 'DEAD' },
      newState: { module: 'live-class', status: 'PENDING' },
      // No event behind an operator action (ADR-034 §4).
      sourceEventId: null,
    });
    // The audit row carries whitelisted scalars only — never the event payload (NFR-005).
    expect(JSON.stringify(input)).not.toContain('payload');
  });

  it('writes no audit row when the row did not move', async () => {
    const harness = createHarness({ replayed: false, status: 'PUBLISHED' });

    const result = await harness.useCase.execute(
      { module: 'live-class', id: '22222222-2222-4222-8222-222222222222' },
      'admin-1',
    );

    expect(result).toEqual({ replayed: false, status: 'PUBLISHED' });
    expect(harness.append).not.toHaveBeenCalled();
  });

  it('does not audit a failed replay when the store throws', async () => {
    const harness = createHarness({ replayed: true, status: 'PENDING' });
    harness.replay.mockRejectedValueOnce(new Error('schema "x" is not initialised'));

    await expect(
      harness.useCase.execute(
        { module: 'live-class', id: '33333333-3333-4333-8333-333333333333' },
        'admin-1',
      ),
    ).rejects.toThrow();

    // The row did not move, so nothing may be claimed in the log.
    expect(harness.append).not.toHaveBeenCalled();
  });
});
