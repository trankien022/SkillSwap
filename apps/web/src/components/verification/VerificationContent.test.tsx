import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../messages/en.json';
const session = vi.hoisted(() => ({ tokens: null as object | null }));
vi.mock('../../lib/api-client', () => ({
  getTokens: () => session.tokens,
  getStoredUser: () => null,
  callApi: vi.fn(async () => new Response('{}', { status: 404 })),
  unwrapEnvelope: vi.fn(),
}));
vi.mock('../navbar', () => ({ Navbar: () => <nav /> }));
const { VerificationContent } = await import('./VerificationContent');
afterEach(() => {
  cleanup();
  session.tokens = null;
  vi.clearAllMocks();
});
describe('verification profile truthfulness', () => {
  it('asks a guest to sign in instead of showing a fabricated student profile', async () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <VerificationContent />
      </NextIntlClientProvider>,
    );
    expect(
      await screen.findByRole('heading', { name: en.Workspace.verification.signInTitle }),
    ).toBeTruthy();
    expect(screen.queryByText(/Minh Nguyễn|2112450098|99.4%|4.9 \/ 5.0/)).toBeNull();
    expect(document.querySelector('input[type=file]')).toBeNull();
  });
  it('does not turn an absent verification record into pending or approved', async () => {
    session.tokens = { accessToken: 'fixture' };
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <VerificationContent />
      </NextIntlClientProvider>,
    );
    expect(await screen.findByText(en.Workspace.verification.status.unsubmitted)).toBeTruthy();
    expect(screen.queryByText(en.Workspace.verification.status.pending)).toBeNull();
    expect(screen.queryByText(en.Workspace.verification.status.approved)).toBeNull();
  });
  it('allows a document with a school name while the optional major is empty', async () => {
    session.tokens = { accessToken: 'fixture' };
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <VerificationContent />
      </NextIntlClientProvider>,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: en.Workspace.verification.uploadAction }),
    );
    fireEvent.change(document.querySelector('#verification-school')!, {
      target: { value: 'Test University' },
    });
    const file = document.querySelector<HTMLInputElement>('#verification-document')!;
    expect(file.disabled).toBe(false);
    expect(document.querySelector<HTMLInputElement>('#verification-major')!.value).toBe('');
  });
});

/**
 * FR-017: "show the Learner their account status and any rejection reason".
 *
 * The status was already rendered; the reason never was, on either client surface the web has.
 * The contract carried it end-to-end the whole time, so the gap was a client that read the
 * status and dropped the sentence next to it.
 */
describe('FR-017 — the learner sees the reason an admin gave', () => {
  /** Routes the mocked `callApi` by path, since the component fetches /auth/me and the view. */
  async function renderWith(verification: Record<string, unknown> | null) {
    const api = await import('../../lib/api-client');
    // The component unwraps the envelope itself, so the stub has to do the same rather than
    // return undefined -- otherwise the view is dropped and nothing renders. Cast to the real
    // signature: vitest wraps the generic in `NormalizedProcedure`, which a plain arrow cannot
    // satisfy even when the runtime shape is identical.
    vi.mocked(api.unwrapEnvelope).mockImplementation((async <T,>(
      res: { readonly status: number; json(): Promise<unknown> },
    ): Promise<T> => {
      const body = (await res.json()) as { data?: T };
      return body.data as T;
    }) as typeof api.unwrapEnvelope);
    vi.mocked(api.callApi).mockImplementation(async (path: string) => {
      if (path === '/auth/me') {
        return new Response(JSON.stringify({ data: { displayName: 'Learner' } }), {
          status: 200,
        });
      }
      if (verification === null) {
        return new Response('{}', { status: 404 });
      }
      return new Response(JSON.stringify({ data: verification }), { status: 200 });
    });
    session.tokens = { accessToken: 'fixture' };
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <VerificationContent />
      </NextIntlClientProvider>,
    );
  }

  it('renders the rejection reason verbatim and labels it', async () => {
    await renderWith({
      id: 'v1',
      status: 'rejected',
      schoolName: 'Test University',
      major: null,
      reason: 'The uploaded document was illegible.',
    });

    const box = await screen.findByTestId('verification-decision-reason');
    expect(box.textContent).toContain(en.Workspace.verification.reasonLabel);
    // Verbatim: the reviewer's words are shown, not translated or summarised.
    expect(box.textContent).toContain('The uploaded document was illegible.');
    expect(screen.getByText(en.Workspace.verification.status.rejected)).toBeTruthy();
  });

  it('shows no reason box for an approved verification, which has none', async () => {
    await renderWith({
      id: 'v2',
      status: 'approved',
      schoolName: 'Test University',
      major: null,
      reason: null,
    });

    expect(await screen.findByText(en.Workspace.verification.status.approved)).toBeTruthy();
    // An empty labelled box would assert a reviewer said something they did not.
    expect(screen.queryByTestId('verification-decision-reason')).toBeNull();
    expect(screen.queryByText(en.Workspace.verification.reasonLabel)).toBeNull();
  });

  it('renders a revocation reason too, since a revocation also carries one', async () => {
    await renderWith({
      id: 'v3',
      status: 'revoked',
      schoolName: 'Test University',
      major: null,
      reason: 'Fake document supplied.',
    });

    const box = await screen.findByTestId('verification-decision-reason');
    expect(box.textContent).toContain('Fake document supplied.');
  });
});
