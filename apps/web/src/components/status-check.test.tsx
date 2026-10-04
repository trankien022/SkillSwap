import { NextIntlClientProvider } from 'next-intl';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../messages/en.json';
import { StatusCheck } from './status-check';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderStatus() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <StatusCheck />
    </NextIntlClientProvider>,
  );
}

function okResponse(payload: unknown) {
  return { ok: true, json: async () => payload };
}

describe('StatusCheck', () => {
  it('shows operational badges when both health endpoints answer', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith('/api/health')
          ? okResponse({
              status: 'ok',
              database: 'up',
              modules: ['wallet-ledger'],
              uptimeSeconds: 42,
            })
          : okResponse({ status: 'ok', service: 'gateway' }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderStatus();

    expect(await screen.findAllByText(en.Status.operational)).toHaveLength(2);
    expect(screen.queryByText(en.Status.down)).toBeNull();
  });

  it('marks a degraded API as degraded while the gateway stays operational', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith('/api/health')
          ? okResponse({
              status: 'degraded',
              database: 'down',
              modules: [],
              uptimeSeconds: 1,
            })
          : okResponse({ status: 'ok', service: 'gateway' }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderStatus();

    expect(await screen.findAllByText(en.Status.operational)).toHaveLength(1);
    expect(screen.getByText(en.Status.degraded)).toBeTruthy();
  });

  it('shows unreachable badges and the failed message when fetch rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('network down'))),
    );

    renderStatus();

    expect(await screen.findAllByText(en.Status.down)).toHaveLength(2);
    expect(
      await screen.findByText(
        en.Status.failed.replace('{url}', 'http://localhost:4000'),
      ),
    ).toBeTruthy();
  });

  it('renders the refresh control', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(okResponse({}))));

    renderStatus();

    expect(screen.getByRole('button', { name: en.Status.refresh })).toBeTruthy();
  });
});
