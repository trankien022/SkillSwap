import {
  claimPendingStatement,
  recordAttemptStatement,
  replayDeadLetterStatement,
  scheduleRetryStatement,
} from './outbox-statements';

/**
 * ADR-013 Amendment A (W2 C2/C3): the outbox SQL.
 *
 * Strings only — there is no database here — so the properties that matter are the ones a
 * reviewer cannot otherwise see: a backing-off row is not claimable, a retryable failure does
 * not touch `attempts`, and a replay is guarded so it can only move a dead row.
 */
describe('outbox statements (ADR-013 Amendment A)', () => {
  const schema = 'live_class';

  it('does not claim a row that is still backing off', () => {
    const sql = claimPendingStatement(schema);

    expect(sql).toContain('next_attempt_at IS NULL OR next_attempt_at <= now()');
    // Rows written before the column existed must stay claimable.
    expect(sql).toContain('status = \'PENDING\'');
  });

  it('keeps a retryable failure away from the attempt counter', () => {
    const sql = scheduleRetryStatement(schema);

    expect(sql).toContain('next_attempt_at');
    expect(sql).toContain('last_error');
    // This is the whole point of C2: a transient failure may never reach DEAD.
    expect(sql).not.toContain('attempts');
    expect(sql).not.toContain('DEAD');
  });

  it('still lets a terminal failure burn the budget', () => {
    const sql = recordAttemptStatement(schema);

    expect(sql).toContain('attempts = attempts + 1');
    expect(sql).toContain('\'DEAD\'');
  });

  it('replays only a DEAD row and makes it due immediately', () => {
    const sql = replayDeadLetterStatement(schema);

    expect(sql).toContain('status = \'DEAD\'');
    expect(sql).toContain('attempts = 0');
    // Without this a replayed row would still be waiting out its old backoff.
    expect(sql).toContain('next_attempt_at = NULL');
    expect(sql).toContain('RETURNING status');
  });

  it('never interpolates the schema without validating it', () => {
    // `qualified` rejects anything unsafe, so an injection attempt fails closed.
    expect(() => claimPendingStatement('live_class; DROP TABLE x')).toThrow(/Unsafe SQL identifier/);
  });
});
