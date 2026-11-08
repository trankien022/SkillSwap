// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OperationsPage from './page';

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async () => (key: string) => key,
}));

vi.mock('../../../components/navbar', () => ({
  Navbar: () => <nav data-testid="navbar" />,
}));

vi.mock('../../../components/landing/SiteFooter', () => ({
  SiteFooter: () => <footer data-testid="site-footer" />,
}));

vi.mock('../../../components/admin/AdminDashboard', () => ({
  AdminDashboard: () => <section data-testid="admin-dashboard">AdminDashboard</section>,
}));

vi.mock('../../../components/admin/SuspendedAccountsPanel', () => ({
  SuspendedAccountsSection: () => (
    <section data-testid="suspended-accounts-section">SuspendedAccountsSection</section>
  ),
}));

afterEach(() => {
  cleanup();
});

describe('OperationsPage composition (W13)', () => {
  it('mounts the shared AdminDashboard and SuspendedAccountsSection inside main without duplicating a verification queue', async () => {
    const jsx = await OperationsPage({ params: Promise.resolve({ locale: 'en' }) });
    render(jsx);

    expect(screen.getByRole('heading', { level: 1, name: 'pageTitle' })).toBeDefined();
    expect(screen.getByTestId('admin-dashboard')).toBeDefined();
    expect(screen.getByTestId('suspended-accounts-section')).toBeDefined();
    expect(screen.queryByTestId('verifier-queue')).toBeNull();
  });
});
