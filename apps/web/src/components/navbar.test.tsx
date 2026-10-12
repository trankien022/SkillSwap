import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { envelopeOk, type MeResponse, type WalletBalanceView } from '@skillswap/contracts';
import { Navbar } from './navbar';

const mockMe = (overrides: Partial<MeResponse> = {}): MeResponse => ({
  id: 'acc-1',
  email: 'test@example.com',
  displayName: 'User',
  role: 'user',
  status: 'active',
  studentVerification: null,
  ...overrides,
});

const mockBalance = (overrides: Partial<WalletBalanceView> = {}): WalletBalanceView => ({
  availableCredits: 0,
  pendingCredits: 0,
  ...overrides,
});

beforeEach(() => {
  // Mock fetch to return valid envelope contracts to avoid unhandled network errors in jsdom
  vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(envelopeOk(mockBalance())), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('Navbar component', () => {
  it('truncates long usernames with title attribute for tooltip and max-width boundaries', () => {
    const longName = 'nguyenchaunhatanh1008';
    render(
      <Navbar
        me={mockMe({
          id: 'acc-1',
          email: `${longName}@gmail.com`,
          displayName: longName,
        })}
      />,
    );

    const nameEl = screen.getByTitle(longName);
    expect(nameEl).toBeDefined();
    expect(nameEl.textContent).toBe(longName);
    expect(nameEl.className).toContain('truncate');
    expect(nameEl.parentElement?.className).toContain('min-w-0');
    expect(nameEl.parentElement?.className).toContain('max-w-');
  });

  it('renders verified student badge when verified', () => {
    render(
      <Navbar
        me={mockMe({
          id: 'acc-2',
          email: 'test@fpt.edu.vn',
          displayName: 'Minh Tu',
          studentVerification: { status: 'approved', reason: null },
        })}
      />,
    );

    const verifiedEl = screen.getByText('SV đã xác minh');
    expect(verifiedEl).toBeDefined();
    expect(verifiedEl.className).toContain('truncate');
  });

  it('renders learner role badge when unverified', () => {
    render(
      <Navbar
        me={mockMe({
          id: 'acc-3',
          email: 'test@gmail.com',
          displayName: 'Anh Khoa',
          studentVerification: { status: 'pending', reason: null },
        })}
      />,
    );

    const learnerEl = screen.getByText('Học viên');
    expect(learnerEl).toBeDefined();
    expect(learnerEl.className).toContain('truncate');
  });

  it('renders credit balance badge', () => {
    render(
      <Navbar
        balance={mockBalance({ availableCredits: 250 })}
      />,
    );

    expect(screen.getByText('250 Credits')).toBeDefined();
  });

  it('renders sign in button when guest', () => {
    render(<Navbar />);

    const signInLink = screen.getByRole('link', { name: 'Đăng nhập' });
    expect(signInLink).toBeDefined();
  });

  it('renders responsive navigation link labels with title tooltip', () => {
    render(<Navbar />);

    const verificationLink = screen.getByTitle('Quản trị & Xác minh');
    expect(verificationLink).toBeDefined();
    expect(verificationLink.textContent).toContain('Quản trị & Xác minh');
    expect(verificationLink.textContent).toContain('Xác minh');
  });
});
