import { NextIntlClientProvider } from 'next-intl';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { envelopeOk } from '@skillswap/contracts';
import en from '../../../messages/en.json';
import InstructorDashboard from './page';

/**
 * Behavioural tests for the teacher lifecycle controls on the instructor
 * dashboard (FR-007 / FR-020).
 *
 * Before this change the screen could only *complete* a class. The two verbs the
 * API already exposed — `POST /classes/:id/start` and `PATCH /classes/:id` — had
 * no UI, so a teacher on web could not start or edit one. These tests assert the
 * screen now calls the documented routes and, on refusal, shows the server's own
 * message rather than a generic string.
 */

const FUTURE = new Date(Date.now() + 72 * 3_600_000).toISOString();

function classItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cls-1',
    description: 'Guitar co-ban',
    startsAt: FUTURE,
    durationMinutes: 60,
    priceCredits: 100,
    capacity: 2,
    confirmedBookingsCount: 0,
    availableSeats: 2,
    state: 'published',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** Routes every endpoint the page and its Navbar touch. */
function stubApi(overrides: {
  classes?: () => Response;
  onPatch?: (init: RequestInit) => Response;
  onStart?: () => Response;
  onComplete?: () => Response;
} = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const method = (init.method ?? 'GET').toUpperCase();

      if (url.includes('/classes?teacherId=me')) {
        return Promise.resolve(
          overrides.classes ? overrides.classes() : jsonResponse(envelopeOk({ items: [classItem()] })),
        );
      }
      if (url.match(/\/classes\/[^/]+\/start$/)) {
        return Promise.resolve(overrides.onStart ? overrides.onStart() : jsonResponse(envelopeOk({ started: true })));
      }
      if (url.match(/\/classes\/[^/]+\/complete$/)) {
        return Promise.resolve(
          overrides.onComplete
            ? overrides.onComplete()
            : jsonResponse(envelopeOk({ completed: true, basis: 'teacher_ended' })),
        );
      }
      if (url.match(/\/classes\/[^/?]+$/) && method === 'PATCH') {
        return Promise.resolve(
          overrides.onPatch ? overrides.onPatch(init) : jsonResponse(envelopeOk(classItem())),
        );
      }
      if (url.includes('/wallet/balance')) {
        return Promise.resolve(
          jsonResponse(envelopeOk({ availableCredits: 0, pendingCredits: 0, currency: 'VND' })),
        );
      }
      return Promise.resolve(jsonResponse(envelopeOk({})));
    }),
  );
  return calls;
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <InstructorDashboard />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('InstructorDashboard lifecycle controls', () => {
  it('starts a published class through the documented route', async () => {
    const calls = stubApi();
    renderPage();

    const startButton = await screen.findByRole('button', { name: /Bắt đầu/ });
    fireEvent.click(startButton);

    await waitFor(() => {
      const start = calls.find((c) => /\/classes\/cls-1\/start$/.test(c.url));
      expect(start).toBeTruthy();
      expect((start!.init.method ?? 'GET').toUpperCase()).toBe('POST');
    });
  });

  it('does not offer start for a class that has already ended', async () => {
    stubApi({ classes: () => jsonResponse(envelopeOk({ items: [classItem({ state: 'completed' })] })) });
    renderPage();

    await screen.findByText('Guitar co-ban');
    expect(screen.queryByRole('button', { name: /Bắt đầu/ })).toBeNull();
  });

  it('saves an edit with PATCH and only the editable fields', async () => {
    const calls = stubApi();
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Sửa/ }));

    const priceInput = await screen.findByLabelText(/Giá mỗi học viên/);
    const capacityInput = screen.getByLabelText(/Số chỗ tối đa/);
    fireEvent.change(priceInput, { target: { value: '150' } });
    fireEvent.change(capacityInput, { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/ }));

    await waitFor(() => {
      const patch = calls.find((c) => (c.init.method ?? '').toUpperCase() === 'PATCH');
      expect(patch).toBeTruthy();
      expect(patch!.url).toContain('/classes/cls-1');
      // Only price and capacity travel; an unrelated field must not be overwritten.
      expect(JSON.parse(String(patch!.init.body))).toEqual({ priceCredits: 150, capacity: 3 });
    });
  });

  it('does not claim a fresh start when the class was already in progress', async () => {
    // The server answers { started: false } for a class already started. That is
    // a truthful no-op, so the screen must not say "Đã bắt đầu lớp học."
    stubApi({ onStart: () => jsonResponse(envelopeOk({ started: false })) });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Bắt đầu/ }));

    expect(await screen.findByText(/đã bắt đầu trước đó/)).toBeTruthy();
    expect(screen.queryByText('Đã bắt đầu lớp học.')).toBeNull();
  });

  it('only mentions released income when the server actually completed the class', async () => {
    // completed:false means nothing was settled; the money claim must not appear.
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit = {}) => {
        const method = (init.method ?? 'GET').toUpperCase();
        if (url.includes('/classes?teacherId=me')) {
          return Promise.resolve(jsonResponse(envelopeOk({ items: [classItem()] })));
        }
        if (url.match(/\/classes\/[^/]+\/complete$/) && method === 'POST') {
          return Promise.resolve(jsonResponse(envelopeOk({ completed: false, basis: null })));
        }
        if (url.includes('/wallet/balance')) {
          return Promise.resolve(
            jsonResponse(envelopeOk({ availableCredits: 0, pendingCredits: 0, currency: 'VND' })),
          );
        }
        return Promise.resolve(jsonResponse(envelopeOk({})));
      }),
    );
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Hoàn thành/ }));

    expect(await screen.findByText(/không còn gì để hoàn thành/)).toBeTruthy();
    expect(screen.queryByText(/Doanh thu đã được giải ngân/)).toBeNull();
  });

  it('shows the server message when the class is locked and keeps the panel honest', async () => {
    stubApi({
      onPatch: () =>
        jsonResponse(
          {
            success: false,
            code: 'ClassLockedError',
            message: 'Class is locked by a confirmed booking',
            data: null,
            errors: [],
          },
          409,
        ),
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Sửa/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Lưu thay đổi/ }));

    // The API's own words are surfaced, not a generic "Lỗi hệ thống".
    expect(await screen.findByText(/Class is locked by a confirmed booking/)).toBeTruthy();
  });

  it('refuses a capacity below the seats already confirmed without calling the API', async () => {
    const calls = stubApi({
      classes: () =>
        jsonResponse(envelopeOk({ items: [classItem({ confirmedBookingsCount: 2, capacity: 2 })] })),
    });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Sửa/ }));
    const capacityInput = await screen.findByLabelText(/Số chỗ tối đa/);
    fireEvent.change(capacityInput, { target: { value: '1' } });

    const save = screen.getByRole('button', { name: /Lưu thay đổi/ }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(calls.some((c) => (c.init.method ?? '').toUpperCase() === 'PATCH')).toBe(false);
  });
});
