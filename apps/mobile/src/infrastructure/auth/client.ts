import type { MeResponse, TokenResponse, WalletBalanceView } from '@skillswap/contracts';
import { requestJson } from '../http/envelope-http-client';

export interface SessionStorage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  remove(): Promise<void>;
}
type Session = { tokens: TokenResponse; rememberUntil: number | null };
export class AuthClient {
  private session: Session | null = null;
  private revision = 0;
  private refreshing: Promise<void> | null = null;
  constructor(
    private base: string,
    private storage: SessionStorage,
    // Bind to the global: a bare `fetch` reference called as a method (or as a
    // bare local) has a receiver of `this`/`undefined`, which the browser rejects
    // with "Illegal invocation".
    private transport: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}
  async restore() {
    const saved = await this.storage.read();
    if (!saved) return;
    try {
      const value = JSON.parse(saved) as Session;
      if (
        !value.tokens?.accessToken ||
        !value.tokens?.refreshToken ||
        typeof value.rememberUntil !== 'number' ||
        value.rememberUntil <= Date.now()
      ) {
        await this.storage.remove();
        return;
      }
      this.session = value;
    } catch {
      await this.storage.remove();
    }
  }
  private async request<T>(path: string, body?: unknown, authorized = true): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      return await requestJson<T>(path, {
        baseUrl: this.base.replace(/\/$/, ''),
        method: body === undefined ? 'GET' : 'POST',
        body,
        signal: controller.signal,
        fetchImpl: this.transport,
        headers:
          authorized && this.session
            ? { Authorization: `Bearer ${this.session.tokens.accessToken}` }
            : {},
      });
    } catch (error) {
      if (error instanceof Error && 'status' in error) throw error;
      throw new Error('Không kết nối được máy chủ. Kiểm tra mạng và địa chỉ API.');
    } finally {
      clearTimeout(timeout);
    }
  }

  async authenticate(mode: 'login' | 'register', body: unknown, remember: boolean) {
    const tokens = await this.request<TokenResponse>(`/auth/${mode}`, body, false);
    if (!tokens?.accessToken || !tokens?.refreshToken)
      throw new Error('Phản hồi đăng nhập không hợp lệ.');
    this.revision++;
    this.session = { tokens, rememberUntil: remember ? Date.now() + 30 * 86400000 : null };
    await this.persist();
  }
  private async persist() {
    if (this.session?.rememberUntil) await this.storage.write(JSON.stringify(this.session));
    else await this.storage.remove();
  }
  private async refresh() {
    if (this.refreshing) return this.refreshing;
    const before = this.session;
    const revision = this.revision;
    if (!before || (before.rememberUntil !== null && before.rememberUntil <= Date.now())) {
      await this.clear();
      throw new Error('Phiên đăng nhập đã hết hạn.');
    }
    this.refreshing = (async () => {
      try {
        const tokens = await this.request<TokenResponse>(
          '/auth/refresh',
          { refreshToken: before.tokens.refreshToken },
          false,
        );
        if (revision !== this.revision) throw new Error('Phiên đăng nhập đã thay đổi.');
        if (!tokens?.accessToken || !tokens?.refreshToken)
          throw new Error('Phản hồi làm mới phiên không hợp lệ.');
        this.session = { ...before, tokens };
        await this.persist();
      } catch (error) {
        if (
          revision === this.revision &&
          [400, 401, 403, 404].includes((error as { status?: number }).status ?? 0)
        )
          await this.clear();
        throw error;
      }
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }
  async get<T>(path: string): Promise<T> {
    if (this.session?.rememberUntil && this.session.rememberUntil <= Date.now()) await this.clear();
    try {
      return await this.request<T>(path);
    } catch (error) {
      if ((error as { status?: number }).status !== 401 || !this.session) throw error;
      await this.refresh();
      return this.request<T>(path);
    }
  }
  me() {
    return this.get<MeResponse>('/auth/me');
  }
  balance() {
    return this.get<WalletBalanceView>('/wallet/balance');
  }
  hasSession() {
    return this.session !== null;
  }
  private async clear() {
    this.revision++;
    this.session = null;
    await this.storage.remove();
  }
  async logout() {
    const refreshToken = this.session?.tokens.refreshToken;
    await this.clear();
    if (refreshToken) await this.request('/auth/logout', { refreshToken }, false);
  }
}
