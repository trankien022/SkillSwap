import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_API_BASE,
  fetchApiHealth,
  fetchGatewayHealth,
  fetchJson,
} from './status';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchJson', () => {
  it('GETs the url and parses JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchJson<{ status: string }>('http://localhost:4000/health')).resolves.toEqual({
      status: 'ok',
    });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4000/health');
  });

  it('rejects on non-2xx responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }),
    );

    await expect(fetchJson('http://localhost:4000/health')).rejects.toThrow('503');
  });

  it('propagates network errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('network down')),
    );

    await expect(fetchJson('http://localhost:4000/health')).rejects.toThrow('network down');
  });
});

describe('health probes', () => {
  it('targets the gateway root and the API public prefix on the default base', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', service: 'gateway' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchGatewayHealth();
    expect(fetchMock).toHaveBeenNthCalledWith(1, `${DEFAULT_API_BASE}/health`);

    await fetchApiHealth();
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${DEFAULT_API_BASE}/api/health`);
  });

  it('honours an explicit base url', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', service: 'gateway' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchGatewayHealth('https://gateway.example.com');
    expect(fetchMock).toHaveBeenCalledWith('https://gateway.example.com/health');
  });
});
