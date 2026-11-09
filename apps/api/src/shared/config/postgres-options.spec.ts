import { sslOptions, extraOptions } from './postgres-options';
import type { ApiConfig } from './api-config';

/** Only the two fields these functions read; the rest of ApiConfig is irrelevant here. */
function config(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    databaseSsl: false,
    databaseSslVerify: true,
    databasePoolMax: 10,
    ...overrides,
  } as ApiConfig;
}

describe('sslOptions (NFR-004)', () => {
  it('returns undefined when TLS is off, so a local server is not asked to upgrade', () => {
    expect(sslOptions(config())).toBeUndefined();
  });

  it('verifies the certificate chain against Neon’s public CA by default', () => {
    expect(sslOptions(config({ databaseSsl: true }))).toEqual({ rejectUnauthorized: true });
  });

  it('can be told not to verify, for a host whose CA is genuinely unavailable', () => {
    expect(sslOptions(config({ databaseSsl: true, databaseSslVerify: false }))).toEqual({
      rejectUnauthorized: false,
    });
  });
});

describe('extraOptions (ADR-007)', () => {
  it('pins search_path to the module schema', () => {
    expect(extraOptions(config(), 'wallet_ledger').options).toBe(
      '-c search_path=wallet_ledger,public',
    );
  });

  it('caps the pool, because seven modules each open their own', () => {
    expect(extraOptions(config({ databasePoolMax: 2 }), 'schedule').max).toBe(2);
  });
});
