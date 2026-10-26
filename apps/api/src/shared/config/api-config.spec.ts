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
