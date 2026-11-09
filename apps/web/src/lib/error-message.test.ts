import { describe, expect, it } from 'vitest';
import { topUpRequestSchema, walletBalanceSchema } from '@skillswap/contracts';
import { describeError } from './error-message';

/**
 * Defect #7: "validation errors render as raw JSON".
 *
 * The cause was not the API. Every `schema.parse(...)` in the web app throws a
 * `ZodError`, whose `message` is `JSON.stringify(issues, null, 2)` — so a form that
 * rendered `err.message` printed a multi-line JSON document where a sentence
 * belonged. These tests pin that a contract rejection reads as prose, that the
 * API's own prose passes through untouched, and that nothing ever renders a
 * serialised blob.
 */

function contractError(parse: () => unknown): unknown {
  try {
    parse();
  } catch (err) {
    return err;
  }
  throw new Error('expected a parse failure');
}

function walletBalanceError(): unknown {
  return contractError(() => walletBalanceSchema.parse({ availableCredits: 'lots' }));
}

function multiFieldError(): unknown {
  return contractError(() => topUpRequestSchema.parse({ amountVnd: -1, returnUrl: '' }));
}

describe('describeError', () => {
  it('renders a contract rejection as field: message, not JSON', () => {
    const shown = describeError(walletBalanceError(), 'Could not load your balance');

    expect(shown).toContain('availableCredits:');
    expect(shown).toContain('Expected number');
  });

  it('never shows braces, brackets or an issue code to the reader', () => {
    const shown = describeError(multiFieldError(), 'Could not top up');

    expect(shown).not.toContain('{');
    expect(shown).not.toContain('[');
    expect(shown).not.toContain('"code"');
    expect(shown).not.toContain('\n');
  });

  it('joins several issues into one sentence rather than an array', () => {
    const shown = describeError(multiFieldError(), 'Could not top up');

    expect(shown).toContain('; ');
    expect(shown.startsWith('amountVnd:') || shown.startsWith('returnUrl:')).toBe(true);
  });

  it('passes the API’s own prose through unchanged', () => {
    // The API already renders `field: message` itself, so the form shows exactly
    // what the server said rather than reformatting it a second time.
    expect(describeError(new Error('email: Invalid email'), 'Fallback')).toBe(
      'email: Invalid email',
    );
  });

  it('uses the fallback for a value that is not an Error', () => {
    expect(describeError('something threw a string', 'Could not save')).toBe('Could not save');
    expect(describeError(null, 'Could not save')).toBe('Could not save');
  });

  it('uses the fallback for an Error with a blank message', () => {
    expect(describeError(new Error('   '), 'Could not save')).toBe('Could not save');
  });

  it('refuses to render a serialised payload even when it arrives as an Error', () => {
    // Belt and braces: if any other layer stringifies a body into a message, the
    // reader still must not see it.
    expect(describeError(new Error('[{"code":"too_big"}]'), 'Could not save')).toBe(
      'Could not save',
    );
    expect(describeError(new Error('{"message":"x"}'), 'Could not save')).toBe('Could not save');
  });

  it('does not mistake prose containing brackets for a payload', () => {
    // `[locale]` appears in this app's own paths; ordinary prose must survive.
    expect(describeError(new Error('Cannot open /en/[locale]/wallet'), 'Fallback')).toBe(
      'Cannot open /en/[locale]/wallet',
    );
  });

  it('renders a root-level contract issue without a field prefix', () => {
    const caught = contractError(() => walletBalanceSchema.parse(42));

    const shown = describeError(caught, 'Fallback');
    expect(shown.startsWith(':')).toBe(false);
    expect(shown).toContain('Expected object');
  });
});
