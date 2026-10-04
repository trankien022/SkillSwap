import { resolve } from 'node:path';
import { GatewayConfig } from './gateway-config';

describe('GatewayConfig', () => {
  it('applies documented defaults for an empty environment', () => {
    const config = new GatewayConfig({});

    expect(config.gatewayPort).toBe(4000);
    expect(config.apiInternalUrl).toBe('http://localhost:4001');
    expect(config.authRequired).toBe(false);
    expect(config.rateLimitWindowMs).toBe(60_000);
    expect(config.rateLimitMax).toBe(300);
  });

  it('reads overrides from the environment', () => {
    const config = new GatewayConfig({
      GATEWAY_PORT: '5001',
      API_INTERNAL_URL: 'http://api:4001',
      AUTH_REQUIRED: 'true',
      RATE_LIMIT_WINDOW_MS: '120000',
      RATE_LIMIT_MAX: '50',
    });

    expect(config.gatewayPort).toBe(5001);
    expect(config.apiInternalUrl).toBe('http://api:4001');
    expect(config.authRequired).toBe(true);
    expect(config.rateLimitWindowMs).toBe(120_000);
    expect(config.rateLimitMax).toBe(50);
  });

  it.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
  ])('parses AUTH_REQUIRED="%s" as %s', (raw, expected) => {
    expect(new GatewayConfig({ AUTH_REQUIRED: raw }).authRequired).toBe(expected);
  });

  it('rejects a non-boolean AUTH_REQUIRED value', () => {
    expect(() => new GatewayConfig({ AUTH_REQUIRED: 'yes' })).toThrow(
      'AUTH_REQUIRED must be "true" or "false"',
    );
  });

  it('rejects a JWT algorithm other than RS256', () => {
    expect(() => new GatewayConfig({ JWT_ALGORITHM: 'HS256' })).toThrow(
      'JWT_ALGORITHM must be "RS256"',
    );
  });

  it('rejects a non-positive-integer port', () => {
    expect(() => new GatewayConfig({ GATEWAY_PORT: 'abc' })).toThrow(
      'GATEWAY_PORT must be a positive integer',
    );
    expect(() => new GatewayConfig({ GATEWAY_PORT: '0' })).toThrow(
      'GATEWAY_PORT must be a positive integer',
    );
  });

  it('resolves a relative JWT_PUBLIC_KEY_PATH against the working directory', () => {
    const config = new GatewayConfig({ JWT_PUBLIC_KEY_PATH: '../../.secrets/jwt-public.pem' });

    expect(config.jwtPublicKeyPath).toBe(resolve(process.cwd(), '../../.secrets/jwt-public.pem'));
  });

  it('keeps an absolute JWT_PUBLIC_KEY_PATH untouched', () => {
    const absolute = process.platform === 'win32' ? 'C:\\keys\\jwt-public.pem' : '/keys/jwt-public.pem';

    expect(new GatewayConfig({ JWT_PUBLIC_KEY_PATH: absolute }).jwtPublicKeyPath).toBe(absolute);
  });
});
