import { describe, expect, it } from 'vitest';
import {
  API_BASE_PATH,
  API_VERSION_PREFIX,
  isPublicPath,
  isUnversionedPath,
  isVersionedPath,
  normalizeApiPath,
  toVersionedPath,
} from '@skillswap/contracts';

/**
 * The versioning change has one failure mode that matters: a path that is owned by a
 * system outside this repository gains a `/v1` segment. The SePay IPN URL is
 * registered once in SePay's dashboard and the JaaS webhook once in the 8x8 console,
 * so a new path stops arriving and the failure is silent — payments quietly stop
 * settling, presence quietly stops recording.
 *
 * These tests pin that those paths are never rewritten, and that ordinary client
 * paths always are.
 */

describe('http path versioning', () => {
  describe('the shape constants', () => {
    it('names one version and one base path', () => {
      expect(API_VERSION_PREFIX).toBe('api/v1');
      expect(API_BASE_PATH).toBe('/api/v1');
    });
  });

  describe('normalizeApiPath', () => {
    it('strips the version segment so legacy and versioned paths compare equal', () => {
      expect(normalizeApiPath('/api/v1/classes')).toBe('/api/classes');
      expect(normalizeApiPath('/api/classes')).toBe('/api/classes');
    });

    it('handles the bare prefixes', () => {
      expect(normalizeApiPath('/api/v1')).toBe('/api');
      expect(normalizeApiPath('/api')).toBe('/api');
    });

    it('does not treat a resource named v1 as a version', () => {
      // Only the segment immediately after /api is the version.
      expect(normalizeApiPath('/api/v1/v1/things')).toBe('/api/v1/things');
      expect(normalizeApiPath('/api/versioned/things')).toBe('/api/versioned/things');
    });

    it('leaves a non-API path alone', () => {
      expect(normalizeApiPath('/healthz')).toBe('/healthz');
    });
  });

  describe('paths owned by another system are never versioned', () => {
    it('keeps the SePay IPN unversioned', () => {
      expect(isUnversionedPath('/api/wallet/top-ups/callback')).toBe(true);
      // Even if a caller hands it the versioned form, it is recognised as neutral.
      expect(isUnversionedPath('/api/v1/wallet/top-ups/callback')).toBe(true);
    });

    it('keeps the JaaS presence webhook unversioned', () => {
      expect(isUnversionedPath('/api/internal/jitsi/presence')).toBe(true);
      expect(isUnversionedPath('/api/v1/internal/jitsi/presence')).toBe(true);
    });

    it('keeps health and docs unversioned', () => {
      expect(isUnversionedPath('/api/health')).toBe(true);
      expect(isUnversionedPath('/api/docs')).toBe(true);
      expect(isUnversionedPath('/api/docs-json')).toBe(true);
    });

    it('does not mistake a similarly named client route for a neutral one', () => {
      // `/api/internal-notes` is not under `/api/internal/jitsi`.
      expect(isUnversionedPath('/api/internal-notes')).toBe(false);
    });
  });

  describe('toVersionedPath — the legacy compatibility rewrite', () => {
    it('upgrades an unversioned client path', () => {
      expect(toVersionedPath('/api/classes')).toBe('/api/v1/classes');
      expect(toVersionedPath('/api/auth/login')).toBe('/api/v1/auth/login');
    });

    it('upgrades the bare /api prefix', () => {
      expect(toVersionedPath('/api')).toBe('/api/v1');
    });

    it('leaves an already versioned path alone', () => {
      expect(toVersionedPath('/api/v1/classes')).toBeNull();
    });

    it('leaves a path owned by another system alone', () => {
      // The decisive cases: these two must never move.
      expect(toVersionedPath('/api/wallet/top-ups/callback')).toBeNull();
      expect(toVersionedPath('/api/internal/jitsi/presence')).toBeNull();
      expect(toVersionedPath('/api/health')).toBeNull();
      expect(toVersionedPath('/api/docs')).toBeNull();
    });

    it('leaves a path that is not under the API prefix alone', () => {
      expect(toVersionedPath('/healthz')).toBeNull();
      expect(toVersionedPath('/apix/classes')).toBeNull();
    });

    it('preserves the query string', () => {
      expect(toVersionedPath('/api/classes?status=open&limit=20')).toBe(
        '/api/v1/classes?status=open&limit=20',
      );
    });

    it('preserves a hash', () => {
      expect(toVersionedPath('/api/classes#top')).toBe('/api/v1/classes#top');
    });
  });

  describe('isPublicPath — the allow-list both services read', () => {
    it('recognises public routes in both forms', () => {
      expect(isPublicPath('/api/auth/login')).toBe(true);
      expect(isPublicPath('/api/v1/auth/login')).toBe(true);
    });

    it('does not free a route that merely starts with a public word', () => {
      // The suffix must begin at a `/` boundary. `/api/auth/logout-all-accounts`
      // shares a prefix with `/api/auth/logout` but is a different route, and an
      // allow-list that frees it would be a hole rather than a convenience.
      expect(isPublicPath('/api/auth/logout-all-accounts')).toBe(false);
      expect(isPublicPath('/api/auth/register-ish')).toBe(false);
      expect(isPublicPath('/api/auth/me')).toBe(false);
      expect(isPublicPath('/api/classes')).toBe(false);
    });

    it('recognises the vendor callbacks in both forms', () => {
      expect(isPublicPath('/api/wallet/top-ups/callback')).toBe(true);
      expect(isPublicPath('/api/v1/wallet/top-ups/callback')).toBe(true);
      expect(isPublicPath('/api/internal/jitsi/presence')).toBe(true);
      expect(isPublicPath('/api/v1/internal/jitsi/presence')).toBe(true);
    });

    it('ignores a query string when matching', () => {
      expect(isPublicPath('/api/auth/login?redirect=x')).toBe(true);
      expect(isPublicPath('/api/classes?status=open')).toBe(false);
    });
  });

  describe('isVersionedPath', () => {
    it('detects the version segment', () => {
      expect(isVersionedPath('/api/v1/classes')).toBe(true);
      expect(isVersionedPath('/api/v1')).toBe(true);
      expect(isVersionedPath('/api/classes')).toBe(false);
      expect(isVersionedPath('/api/v1x/classes')).toBe(false);
    });
  });
});
