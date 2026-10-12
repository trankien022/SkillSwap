import { GatewayClient } from './gateway-client';
import type { MobileConfig } from '../config';

/**
 * Regression: the browser's `fetch` rejects with
 *
 *   Failed to execute 'fetch' on 'Window': Illegal invocation
 *
 * unless it is called with `window` (the global object) as its receiver. Storing
 * the bare `fetch` reference and invoking it as `this.fetchFn(...)` makes the
 * receiver the client instance, which the browser refuses.
 *
 * Node's `fetch` does not enforce this, so the whole unit suite passed while the
 * app failed on its first request in a browser — and DevTools showed no request,
 * because the throw happens inside `fetch` before anything reaches the network.
 *
 * This mock enforces the rule and records the receiver, so any future code that
 * loses the binding fails here instead of in the browser.
 */
describe('fetch receiver binding (browser parity)', () => {
  const config: MobileConfig = {
    gatewayBaseUrl: 'http://localhost:4000',
    apiBaseUrl: 'http://localhost:4000/api',
  };

  // Matches the shape the existing GatewayClient specs use: the client only
  // unwraps when `success` is present, so a bare token payload is returned as-is.
  const tokenPayload = {
    accessToken: 'a',
    refreshToken: 'r',
    expiresIn: 3600,
    tokenType: 'Bearer',
  };

  const asResponse = (body: unknown) =>
    ({
      ok: true,
      status: 200,
      json: async () => body,
    }) as unknown as Response;

  it('calls the default fetch with the global receiver, so login does not throw Illegal invocation', async () => {
    const receivers: unknown[] = [];

    // Enforces the browser rule exactly: the receiver MUST be the global object.
    // Chrome throws this for any other receiver, including an object instance
    // such as the client. A lenient check (only rejecting undefined/null) would
    // pass against the broken code, so the receiver is compared to the global.
    const receiverEnforcingFetch = function (this: unknown) {
      receivers.push(this);
      if (this !== globalThis) {
        throw new TypeError(
          "Failed to execute 'fetch' on 'Window': Illegal invocation",
        );
      }
      return Promise.resolve(asResponse(tokenPayload));
    };

    const original = (globalThis as { fetch?: unknown }).fetch;
    (globalThis as { fetch: unknown }).fetch = receiverEnforcingFetch;

    try {
      const client = new GatewayClient(config);

      await expect(
        client.login({ email: 'user1@demo.skillswap.local', password: 'Demo1234!' }),
      ).resolves.toMatchObject({ accessToken: 'a' });

      // The load-bearing assertion: the receiver must be the global, not the client.
      expect(receivers).toHaveLength(1);
      expect(receivers[0]).toBeDefined();
      expect(receivers[0]).not.toBeNull();
    } finally {
      (globalThis as { fetch: unknown }).fetch = original;
    }
  });

  it('calls an injected fetch successfully, preserving the existing injection contract', async () => {
    const receivers: unknown[] = [];

    const injected = function (this: unknown) {
      receivers.push(this);
      return Promise.resolve(asResponse(tokenPayload));
    };

    const client = new GatewayClient(config, {
      fetchFn: injected as unknown as typeof fetch,
    });

    await client.login({ email: 'user1@demo.skillswap.local', password: 'Demo1234!' });

    // The injection contract is unchanged: the stub is called exactly once.
    // (With a bound default fetch the receiver is the global; an injected stub is
    // invoked as a method, which is harmless because it does not enforce the
    // browser's Window-receiver rule.)
    expect(receivers).toHaveLength(1);
  });
});
