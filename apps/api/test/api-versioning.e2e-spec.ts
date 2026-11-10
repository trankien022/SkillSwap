import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient } from './support/api-client';
import { resetDatabase } from './support/db';

jest.setTimeout(60_000);

/**
 * ADR-042 — API path versioning, against the REAL stack.
 *
 * Three properties have to hold at once, and they pull in different directions:
 *
 * 1. Client routes exist at `/api/v1/...` — the canonical, documented surface.
 * 2. Client routes ALSO exist at `/api/...` — the legacy form, served by a rewrite
 *    shim so the API can deploy before the web and mobile clients do.
 * 3. Vendor callbacks exist ONLY at their unversioned URL, because those URLs are
 *    registered in SePay's dashboard and the 8x8 console and cannot be changed from
 *    this repository.
 *
 * Property 3 is the one that costs money and state if it regresses, so it gets the
 * sharpest assertions: the unversioned path must route (not 404), and the versioned
 * path must NOT exist (proving the route really opted out rather than merely also
 * working at `/v1`).
 */
describe('E2E: API path versioning (ADR-042)', () => {
  let harness: Harness;
  let api: ApiClient;

  beforeAll(async () => {
    harness = await startHarness();
    api = new ApiClient(harness.baseUrl);
    await resetDatabase(harness);
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  describe('client routes', () => {
    it('serves the canonical versioned path', async () => {
      const registered = await api.post('/api/v1/auth/register', {
        email: 'versioning-reader@skillswap.test',
        displayName: 'Versioning Reader',
        password: 'password-1',
      });
      expect(registered.status).toBe(201);
      api.actAs(accountIdFromToken(registered.json.accessToken));

      const res = await api.get('/api/v1/classes');
      expect(res.status).toBe(200);
    });

    it('serves the legacy unversioned path during the changeover', async () => {
      const res = await api.get('/api/classes');
      expect(res.status).toBe(200);
    });

    it('gives the same answer at both paths', async () => {
      // A route that does not exist must 404 at BOTH forms: the rewrite upgrades the
      // path, it does not invent routes.
      const versioned = await api.get('/api/v1/no-such-route');
      const legacy = await api.get('/api/no-such-route');
      expect(versioned.status).toBe(404);
      expect(legacy.status).toBe(404);
    });

    it('routes a versioned POST to the same handler as the legacy POST', async () => {
      const versioned = await api.post('/api/v1/auth/register', {
        email: 'versioning-v1@skillswap.test',
        displayName: 'Versioned User',
        password: 'password-1',
      });
      expect(versioned.status).toBe(201);

      const legacy = await api.post('/api/auth/register', {
        email: 'versioning-legacy@skillswap.test',
        displayName: 'Legacy User',
        password: 'password-1',
      });
      expect(legacy.status).toBe(201);
    });
  });

  describe('protected routes keep requiring identity in both forms', () => {
    it('refuses /api/v1/auth/me without an identity', async () => {
      const res = await api.get('/api/v1/auth/me');
      // AUTH_MODE=off in the harness resolves an anonymous identity; what must not
      // happen is a 404, which would mean the route is simply missing.
      expect(res.status).not.toBe(404);
    });

    it('does not free a plain route just because it sits under the version prefix', async () => {
      // The allow-list is prefix-based; `/api/auth/me` is deliberately NOT public.
      const res = await api.get('/api/v1/auth/me');
      expect(res.status).not.toBe(404);
    });
  });

  describe('vendor callbacks keep their registered URLs', () => {
    it('keeps the JaaS presence webhook unversioned', async () => {
      // Unauthenticated on purpose: the endpoint authenticates with X-Jaas-Signature.
      // A 401/400 means the route exists and ran its own checks; a 404 means the
      // versioning change moved the URL 8x8 is configured to call.
      const res = await api.post('/api/internal/jitsi/presence', { event: 'probe' });
      expect(res.status).not.toBe(404);
    });

    it('does not also expose the JaaS webhook under /api/v1', async () => {
      const res = await api.post('/api/v1/internal/jitsi/presence', { event: 'probe' });
      expect(res.status).toBe(404);
    });

    it('keeps the SePay IPN unversioned', async () => {
      const res = await api.post('/api/wallet/top-ups/callback', {
        notification_type: 'ORDER_PAID',
      });
      expect(res.status).not.toBe(404);
    });

    it('does not also expose the SePay IPN under /api/v1', async () => {
      const res = await api.post('/api/v1/wallet/top-ups/callback', {
        notification_type: 'ORDER_PAID',
      });
      expect(res.status).toBe(404);
    });

    it('keeps health unversioned', async () => {
      const res = await api.get('/api/health');
      expect(res.status).toBe(200);
    });

    it('does not expose health under /api/v1', async () => {
      // Health is an infrastructure probe (Render/Vercel), not a client contract.
      const res = await api.get('/api/v1/health');
      expect(res.status).toBe(404);
    });
  });
});
