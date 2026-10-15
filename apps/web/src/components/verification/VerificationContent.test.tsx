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
