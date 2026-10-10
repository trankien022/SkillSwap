/** Minimal JSON HTTP client over the live server (no test-framework dependency). */
export class ApiClient {
  private accessToken: string | null = null;
  /** Identity the trusted-identity guard reads (stand-in for the gateway). */
  private userId: string | null = null;
  private userRole: string | null = null;

  constructor(private readonly baseUrl: string) {}

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  /** Acts as `userId` for subsequent requests (AUTH_MODE=off uses the header when present). */
  actAs(userId: string | null, role: string | null = null): void {
    this.userId = userId;
    this.userRole = role;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    if (this.accessToken !== null) {
      headers.authorization = `Bearer ${this.accessToken}`;
    }
    if (this.userId !== null) {
      headers['x-user-id'] = this.userId;
    }
    if (this.userRole !== null) {
      headers['x-user-role'] = this.userRole;
    }
    return headers;
  }

  async request(
    method: string,
    path: string,
    body?: unknown,
    options: { signature?: string } = {},
    // Response bodies are untyped test fixtures; `any` keeps the specs readable.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<{ status: number; json: any; text: string }> {
    const headers = this.headers({ 'content-type': 'application/json' });
    if (options.signature !== undefined) {
      headers['x-signature'] = options.signature;
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text === '' ? null : JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: response.status, json, text };
  }

  get(path: string) {
    return this.request('GET', path);
  }
  post(path: string, body?: unknown) {
    return this.request('POST', path, body);
  }
  patch(path: string, body?: unknown) {
    return this.request('PATCH', path, body);
  }
}

/** Decodes the `sub` (account id) from an access token returned by /auth/*. */
export function accountIdFromToken(accessToken: string): string {
  const payload = accessToken.split('.')[1];
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string };
  if (typeof decoded.sub !== 'string' || decoded.sub === '') {
    throw new Error('Access token is missing a sub claim');
  }
  return decoded.sub;
}

/** Polls until `predicate` is truthy or the timeout elapses (event propagation). */export async function waitFor<T>(
  predicate: () => Promise<T | null | undefined | false>,
  { timeoutMs = 15_000, intervalMs = 150 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await predicate();
    if (result) {
      return result as T;
    }
    if (Date.now() > deadline) {
      throw new Error(`waitFor: condition not met within ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
