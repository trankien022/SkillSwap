import { isRetryablePublishError, isTerminalPublishError } from './publish-error-classification';
import { BrokerUnavailableError, ModuleNotInitialisedError, OutboxPayloadInvalidError } from '../errors';

/**
 * ADR-013 Amendment A / W2 C2 (decided 2026-10-25): only a schema-validation
 * failure at publish time is terminal. These specs pin the asymmetry — an
 * unrecognised error must retry, because retrying a poison payload costs log
 * noise while dropping a real event costs money (BR-033).
 */
describe('publish error classification (ADR-013 Amendment A)', () => {
  it('treats a payload validation failure as terminal', () => {
    const error = new OutboxPayloadInvalidError('payload failed schema validation');

    expect(isTerminalPublishError(error)).toBe(true);
    expect(isRetryablePublishError(error)).toBe(false);
  });

  it('treats a payload validation failure by name too, across module boundaries', () => {
    // `shared/errors.ts` documents that classification is by name, because an
    // `instanceof` check would fail for an error raised in another context.
    const error = Object.assign(new Error('payload failed schema validation'), {
      name: 'OutboxPayloadInvalidError',
    });

    expect(isTerminalPublishError(error)).toBe(true);
  });

  it.each([
    ['ECONNRESET', Object.assign(new Error('reset'), { code: 'ECONNRESET' })],
    ['EPIPE', Object.assign(new Error('broken pipe'), { code: 'EPIPE' })],
    ['ETIMEDOUT', Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' })],
    ['ECONNREFUSED', Object.assign(new Error('refused'), { code: 'ECONNREFUSED' })],
    ['08P01 (postgres protocol)', Object.assign(new Error('protocol'), { code: '08P01' })],
    ['57014 (statement timeout)', Object.assign(new Error('timeout'), { code: '57014' })],
    ['BrokerUnavailableError', new BrokerUnavailableError('down')],
    ['ModuleNotInitialisedError', new ModuleNotInitialisedError('live-class')],
  ])('treats %s as retryable', (_label, error) => {
    expect(isRetryablePublishError(error)).toBe(true);
    expect(isTerminalPublishError(error)).toBe(false);
  });

  it('treats an unrecognised error as retryable rather than terminal', () => {
    // This is the deliberately conservative direction: we only give up on a row
    // when we can prove the payload is at fault.
    expect(isRetryablePublishError(new Error('channel write failed'))).toBe(true);
    expect(isRetryablePublishError('a bare string')).toBe(true);
    expect(isRetryablePublishError(undefined)).toBe(true);
  });

  it('does not let a payload error hide behind a transient errno code', () => {
    // If both signals are present the payload verdict wins: retrying cannot help.
    const error = Object.assign(new OutboxPayloadInvalidError('bad payload'), {
      code: 'ECONNRESET',
    });

    expect(isTerminalPublishError(error)).toBe(true);
  });
});
