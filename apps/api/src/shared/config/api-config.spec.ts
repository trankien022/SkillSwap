import { ApiConfig } from './api-config';

/**
 * BR-027 / decision D3: VND per credit is configuration, not a constant.
 *
 * The assertions here are about the *failure*, not the happy path. A rate of 0 divides by zero
 * and a negative rate turns a deposit into a withdrawal, so the only acceptable response to a bad
 * value is to refuse to start — never to fall back to a default and price somebody's money at it.
 */
describe('ApiConfig.vndPerCredit (BR-027 / D3)', () => {
  const original = process.env.VND_PER_CREDIT;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.VND_PER_CREDIT;
    } else {
      process.env.VND_PER_CREDIT = original;
    }
  });

  it('defaults to 1000, the value that was hardcoded before the decision', () => {
    delete process.env.VND_PER_CREDIT;
    // Pinned literally: the whole point of a default is that an unconfigured deployment keeps
    // pricing exactly as the old constant did, so deriving it from the constant would hide a
    // deliberate change behind a green test.
    expect(new ApiConfig().vndPerCredit).toBe(1000);
  });

  it('reads a configured rate', () => {
    process.env.VND_PER_CREDIT = '500';
    expect(new ApiConfig().vndPerCredit).toBe(500);
  });

  it.each(['0', '-1000', 'abc'])('refuses to start with VND_PER_CREDIT=%s', (value) => {
    process.env.VND_PER_CREDIT = value;
    expect(() => new ApiConfig()).toThrow(/VND_PER_CREDIT/);
  });
});

/**
 * NFR-004: a managed Postgres refuses plaintext connections, so TLS has to be configuration.
 *
 * The assertions below are mostly about what happens on a *bad* value. These two flags decide
 * whether real credentials and real money movements cross the network in plaintext, so an
 * unrecognised value must stop the process rather than quietly resolve to the insecure branch.
 */
describe('ApiConfig database TLS (NFR-004)', () => {
  const KEYS = ['DATABASE_SSL', 'DATABASE_SSL_VERIFY', 'DATABASE_POOL_MAX'] as const;
  const original = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

  afterEach(() => {
    for (const key of KEYS) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  });

  it('leaves TLS off by default, so the local docker server still connects', () => {
    for (const key of KEYS) delete process.env[key];
    expect(new ApiConfig().databaseSsl).toBe(false);
  });

  it('verifies certificates by default when TLS is on', () => {
    for (const key of KEYS) delete process.env[key];
    expect(new ApiConfig().databaseSslVerify).toBe(true);
  });

  it.each([
    ['true', true],
    ['TRUE', true],
    ['1', true],
    ['on', true],
    ['false', false],
    ['0', false],
    ['off', false],
  ])('reads DATABASE_SSL=%s as %s', (raw, expected) => {
    process.env.DATABASE_SSL = raw;
    expect(new ApiConfig().databaseSsl).toBe(expected);
  });

  it('refuses to start on an unparseable TLS flag instead of assuming the insecure side', () => {
    process.env.DATABASE_SSL = 'ture';
    expect(() => new ApiConfig()).toThrow(/DATABASE_SSL/);
  });

  it.each(['0', '-1', 'abc'])('refuses a pool size of %s', (value) => {
    process.env.DATABASE_POOL_MAX = value;
    expect(() => new ApiConfig()).toThrow(/DATABASE_POOL_MAX/);
  });
});
