import { AuthClient, type SessionStorage } from './client';
const tokens = { accessToken: 'a', refreshToken: 'r', expiresIn: 900, tokenType: 'Bearer' };
const response = (data: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => ({
    success: status < 400,
    code: status < 400 ? 'OK' : 'HTTP_401',
    message: 'test',
    data,
    errors: [],
  }),
});
function setup() {
  let saved: string | null = null;
  const storage: SessionStorage = {
    read: async () => saved,
    write: async (value) => {
      saved = value;
    },
    remove: async () => {
      saved = null;
    },
  };
  const transport = jest.fn();
  return {
    storage,
    transport,
    client: new AuthClient('http://gateway', storage, transport),
    saved: () => saved,
  };
}
it('unwraps envelopes without persisting unremembered tokens', async () => {
  const { client, transport, saved } = setup();
  transport.mockResolvedValueOnce(response(tokens)).mockResolvedValueOnce(response({ id: 'u' }));
  await client.authenticate('login', {}, false);
  expect(saved()).toBeNull();
  expect(await client.me()).toEqual({ id: 'u' });
  expect(transport.mock.calls[1][1].headers.Authorization).toBe('Bearer a');
});
it('restores remembered sessions and drops expired storage', async () => {
  const { client, transport, storage, saved } = setup();
  transport.mockResolvedValue(response(tokens));
  await client.authenticate('login', {}, true);
  const another = new AuthClient('http://gateway', storage, transport);
  await another.restore();
  expect(another.hasSession()).toBe(true);
  await storage.write(JSON.stringify({ tokens, rememberUntil: Date.now() - 1 }));
  const expired = new AuthClient('http://gateway', storage, transport);
  await expired.restore();
  expect(expired.hasSession()).toBe(false);
  expect(saved()).toBeNull();
});
it('shares concurrent refresh and retries with rotated access token', async () => {
  const { client, transport } = setup();
  transport.mockImplementation(
    async (url: string, init: { headers: { Authorization?: string } }) => {
      if (url.endsWith('/login')) return response(tokens);
      if (url.endsWith('/refresh'))
        return response({ ...tokens, accessToken: 'new', refreshToken: 'rotated' });
      return init.headers.Authorization === 'Bearer new'
        ? response({ id: 'u' })
        : response({}, 401);
    },
  );
  await client.authenticate('login', {}, true);
  await Promise.all([client.me(), client.me()]);
  expect(transport.mock.calls.filter((call) => call[0].endsWith('/refresh'))).toHaveLength(1);
});
it('prevents late refresh from undoing logout', async () => {
  const { client, transport } = setup();
  let resolveRefresh: (value: unknown) => void = () => {};
  transport.mockImplementation(async (url: string) => {
    if (url.endsWith('/login')) return response(tokens);
    if (url.endsWith('/refresh'))
      return new Promise((resolve) => {
        resolveRefresh = resolve;
      });
    if (url.endsWith('/logout')) return response(null, 204);
    return response({}, 401);
  });
  await client.authenticate('login', {}, true);
  const pending = client.me();
  const result = expect(pending).rejects.toThrow('Phiên đăng nhập đã thay đổi.');
  await new Promise((resolve) => setTimeout(resolve, 0));
  await client.logout();
  resolveRefresh(response(tokens));
  await result;
  expect(client.hasSession()).toBe(false);
});
