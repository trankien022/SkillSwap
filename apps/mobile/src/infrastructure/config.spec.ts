import { ConfigurationError, resolveMobileConfig } from './config';

describe('resolveMobileConfig', () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_BASE_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_BASE_URL = originalEnv;
  });

  describe('Static process.env and Input resolution', () => {
    it('uses static process.env.EXPO_PUBLIC_API_BASE_URL when input is omitted', () => {
      process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:4000';
      const config = resolveMobileConfig();
      expect(config.gatewayBaseUrl).toBe('http://localhost:4000');
      expect(config.apiBaseUrl).toBe('http://localhost:4000/api');
    });

    it('throws ConfigurationError when variable is missing or blank', () => {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
      expect(() => resolveMobileConfig()).toThrow(ConfigurationError);
      expect(() => resolveMobileConfig({ expoPublicApiBaseUrl: '' })).toThrow(
        /Missing EXPO_PUBLIC_API_BASE_URL/,
      );
      expect(() => resolveMobileConfig({ expoPublicApiBaseUrl: '   ' })).toThrow(
        /Missing EXPO_PUBLIC_API_BASE_URL/,
      );
    });
  });

  describe('Protocol and Syntax Boundaries', () => {
    it('rejects non-http(s) protocols', () => {
      expect(() =>
        resolveMobileConfig({ expoPublicApiBaseUrl: 'ftp://localhost:4000' }),
      ).toThrow(/must use http: or https: protocol/);

      expect(() =>
        resolveMobileConfig({ expoPublicApiBaseUrl: 'ws://localhost:4000' }),
      ).toThrow(/must use http: or https: protocol/);

      expect(() =>
        resolveMobileConfig({ expoPublicApiBaseUrl: 'javascript:alert(1)' }),
      ).toThrow(/must use http: or https: protocol/);
    });

    it('rejects invalid URL syntax without crashing', () => {
      expect(() =>
        resolveMobileConfig({ expoPublicApiBaseUrl: 'not_a_valid_url' }),
      ).toThrow(/Invalid URL provided/);
    });
  });

  describe('Security Boundaries (Credentials, Query, Fragment)', () => {
    it('rejects URLs with embedded username or password without echoing credentials', () => {
      const sensitivePassword = 'superSecretPassword123';
      const urlWithCredentials = `http://admin:${sensitivePassword}@localhost:4000`;

      let caughtError: Error | undefined;
      try {
        resolveMobileConfig({ expoPublicApiBaseUrl: urlWithCredentials });
      } catch (err) {
        caughtError = err as Error;
      }

      expect(caughtError).toBeInstanceOf(ConfigurationError);
      expect(caughtError?.message).toContain('embedded user credentials');
      expect(caughtError?.message).not.toContain(sensitivePassword);
      expect(caughtError?.message).not.toContain('admin');
    });

    it('rejects URLs containing query strings', () => {
      expect(() =>
        resolveMobileConfig({ expoPublicApiBaseUrl: 'http://localhost:4000?foo=bar' }),
      ).toThrow(/must not contain a query string/);
    });

    it('rejects URLs containing URL fragments or hashes', () => {
      expect(() =>
        resolveMobileConfig({ expoPublicApiBaseUrl: 'http://localhost:4000#section' }),
      ).toThrow(/must not contain a URL hash or fragment/);
    });
  });

  describe('Path and Slash Normalization', () => {
    it('normalizes localhost and trims trailing slashes', () => {
      const config = resolveMobileConfig({
        expoPublicApiBaseUrl: 'http://localhost:4000///',
      });
      expect(config.gatewayBaseUrl).toBe('http://localhost:4000');
      expect(config.apiBaseUrl).toBe('http://localhost:4000/api');
    });

    it('strips redundant /api and /api/ from path', () => {
      const config1 = resolveMobileConfig({
        expoPublicApiBaseUrl: 'http://192.168.1.100:4000/api',
      });
      expect(config1.gatewayBaseUrl).toBe('http://192.168.1.100:4000');
      expect(config1.apiBaseUrl).toBe('http://192.168.1.100:4000/api');

      const config2 = resolveMobileConfig({
        expoPublicApiBaseUrl: 'http://192.168.1.100:4000/api///',
      });
      expect(config2.gatewayBaseUrl).toBe('http://192.168.1.100:4000');
      expect(config2.apiBaseUrl).toBe('http://192.168.1.100:4000/api');
    });

    it('supports HTTPS domain configurations', () => {
      const config = resolveMobileConfig({
        expoPublicApiBaseUrl: 'https://gateway.skillswap.edu.vn',
      });
      expect(config.gatewayBaseUrl).toBe('https://gateway.skillswap.edu.vn');
      expect(config.apiBaseUrl).toBe('https://gateway.skillswap.edu.vn/api');
    });
  });
});
