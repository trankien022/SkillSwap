import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { envelopeOk } from '@skillswap/contracts';
import en from '../messages/en.json';
import { VerifierQueuePage } from './verifier-queue';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('VerifierQueuePage (W6)', () => {
  it('renders the evidence description, documentRef with unavailable notice, formatted submittedAt, and omits raw ownerId', async () => {
    const rawIso = '2026-10-15T08:30:00.000Z';
    const longDescription =
      'Built distributed microservices in Go and Node.js over 3 semesters, mentored 15 junior students in backend system design.';

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            envelopeOk({
              items: [
                {
                  id: 'ev-1',
                  profileSkillId: 'psk-1',
                  ownerId: 'raw-owner-uuid-9999',
                  skillId: 'skl-1',
                  skillName: 'Backend Architecture',
                  category: 'Programming',
                  requestedLevel: 'advanced',
                  approvedLevel: null,
                  evidenceType: 'certificate',
                  documentRef: 'cert-ref-2026-abc',
                  description: longDescription,
                  status: 'pending',
                  version: 1,
                  claimedBy: null,
                  claimedAt: null,
                  decidedBy: null,
                  decidedAt: null,
                  reason: null,
                  rejectionReason: null,
                  submittedAt: rawIso,
                },
              ],
              page: {
                limit: 20,
                nextCursor: null,
                total: 1,
              },
            }),
          ),
        ),
      ),
    );

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <VerifierQueuePage />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(longDescription)).toBeDefined();
    });

    expect(screen.getByText('cert-ref-2026-abc')).toBeDefined();
    expect(screen.getByText(`(${en.Verifier.row.documentUnavailable})`)).toBeDefined();
    expect(screen.queryByText(/raw-owner-uuid-9999/)).toBeNull();
    expect(screen.queryByText(new RegExp(rawIso))).toBeNull();
  });

  /**
   * Defect #7: a response that fails the shared contract used to surface as the
   * `ZodError` message, which is `JSON.stringify(issues, null, 2)`. The screen
   * printed a JSON document at the reviewer. It must read as prose that names the
   * offending field instead, and must never show braces or an issue `code`.
   */
  it('shows a readable reason, not a JSON blob, when the response breaks its contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(
            envelopeOk({
              items: [{ id: 42, skillName: null }],
              page: { limit: 20, nextCursor: null, total: 1 },
            }),
          ),
        ),
      ),
    );

    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <VerifierQueuePage />
      </NextIntlClientProvider>,
    );

    // The pre-fix screen rendered `ZodError#message`, which is the issues array
    // serialised — an issue object carries a `code`, and nothing the reader can
    // use. Waiting on the absence of it first makes that failure the one reported.
    await waitFor(() => {
      expect(container.textContent).not.toContain('"code"');
    });
    expect(container.textContent).not.toContain('{');
    expect(container.textContent).toContain('items.0.id: Expected string, received number');
  });
});
