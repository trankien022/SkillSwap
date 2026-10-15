import {
  MOBILE_RETURN_URL_SCHEME,
  ReturnUrlNotAllowedError,
  allowedBrowserOrigins,
  resolveReturnUrl,
  withProviderRef,
} from './return-url';

/**
 * The allow-list is the only thing standing between a client-supplied URL and
 * SePay's `success_url`/`error_url`/`cancel_url`, so each branch is pinned.
 */
const CONFIGURED = 'https://discuss-showbiz-octagon.ngrok-free.dev';

describe('resolveReturnUrl', () => {
  it('falls back to the configured URL when the client sends nothing', () => {
    expect(resolveReturnUrl(undefined, CONFIGURED)).toBe(CONFIGURED);
    expect(resolveReturnUrl('   ', CONFIGURED)).toBe(CONFIGURED);
  });

  it('accepts the configured origin', () => {
    const web = `${CONFIGURED}/vi/payment/result`;
    expect(resolveReturnUrl(web, CONFIGURED)).toBe(web);
  });

  it('accepts an origin the operator listed explicitly', () => {
    // The payer's browser usually runs the client on a different origin from
    // the configured return URL in development (a tunnel vs localhost). That
    // origin has to be written down, not inferred.
    const web = 'http://localhost:3000/vi/payment/result';
    expect(resolveReturnUrl(web, CONFIGURED, ['http://localhost:3000'])).toBe(web);
  });

  it('refuses an origin that is configured as the return URL but not listed', () => {
    // Without an explicit allow-list the only accepted origin is the configured
    // one, so a sibling origin is refused rather than assumed.
    expect(() => resolveReturnUrl('http://localhost:3000/vi/payment/result', CONFIGURED)).toThrow(
      ReturnUrlNotAllowedError,
    );
  });

  it('accepts the mobile app scheme', () => {
    expect(resolveReturnUrl('skillswap://wallet', CONFIGURED)).toBe('skillswap://wallet');
    // Even with no configured web URL at all, the app scheme is ours.
    expect(resolveReturnUrl('skillswap://wallet', '')).toBe('skillswap://wallet');
  });

  it('refuses a foreign origin instead of rewriting it', () => {
    expect(() => resolveReturnUrl('https://evil.example/phish', CONFIGURED)).toThrow(
      ReturnUrlNotAllowedError,
    );
    // A lookalike host is not the configured origin either.
    expect(() =>
      resolveReturnUrl('https://discuss-showbiz-octagon.ngrok-free.dev.evil.example/', CONFIGURED),
    ).toThrow(ReturnUrlNotAllowedError);
    // A different scheme on the same host is a different origin.
    expect(() =>
      resolveReturnUrl('http://discuss-showbiz-octagon.ngrok-free.dev/', CONFIGURED),
    ).toThrow(ReturnUrlNotAllowedError);
  });

  it('refuses a browser URL when no configured URL exists to compare against', () => {
    expect(() => resolveReturnUrl('https://anything.example/', '')).toThrow(
      ReturnUrlNotAllowedError,
    );
    // A configured value that is not a web URL cannot define an origin either.
    expect(() => resolveReturnUrl('https://anything.example/', 'not-a-url')).toThrow(
      ReturnUrlNotAllowedError,
    );
  });

  it('refuses a malformed client URL', () => {
    expect(() => resolveReturnUrl('/vi/payment/result', CONFIGURED)).toThrow(
      ReturnUrlNotAllowedError,
    );
  });

  it('names the scheme it trusts', () => {
    expect(MOBILE_RETURN_URL_SCHEME).toBe('skillswap:');
  });
});

describe('allowedBrowserOrigins', () => {
  it('always includes the configured origin and every valid listed one', () => {
    expect(allowedBrowserOrigins(CONFIGURED, [])).toEqual(new Set([CONFIGURED]));
    expect(
      allowedBrowserOrigins(CONFIGURED, [
        'http://localhost:3000',
        '  https://app.example.test/  ',
        '',
        'not-a-url',
        // A custom scheme has no origin and would make every such URL compare
        // equal, so it is dropped rather than trusted.
        'skillswap://wallet',
      ]),
    ).toEqual(
      new Set([CONFIGURED, 'http://localhost:3000', 'https://app.example.test']),
    );
  });
});

describe('withProviderRef', () => {
  it('attaches the invoice number to a web return URL', () => {
    expect(withProviderRef('https://app.example.test/vi/payment/result', 'SS-1-A1B2C3')).toBe(
      'https://app.example.test/vi/payment/result?providerRef=SS-1-A1B2C3',
    );
  });

  it('keeps any parameters the URL already carried', () => {
    expect(withProviderRef('https://app.example.test/vi/payment/result?tab=wallet', 'SS-2-B')).toBe(
      'https://app.example.test/vi/payment/result?tab=wallet&providerRef=SS-2-B',
    );
  });

  it('leaves the app deep link untouched', () => {
    // A custom scheme cannot carry a query, and appending one would change the
    // screen the OS opens.
    expect(withProviderRef('skillswap://wallet', 'SS-3-C')).toBe('skillswap://wallet');
  });
});
