import { setRequestLocale } from 'next-intl/server';
import { MarketplaceHeader } from '../../../components/marketplace/MarketplaceHeader';
import { SiteFooter } from '../../../components/landing/SiteFooter';
import { DashboardHeader } from '../../../components/dashboard/DashboardHeader';
import { DashboardShell } from '../../../components/dashboard/DashboardShell';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Learner dashboard page (FR-021 booking lifecycle, FR-013 review,
 * FR-038 escrow release).
 *
 * The two endpoints behind this screen (`GET /classes/bookings/me`,
 * `GET /wallet/balance`) are authenticated, so the snapshot cannot be read on
 * the server — the bearer token lives in the browser. The server component
 * renders only the chrome; `DashboardShell` performs the session-aware fetch
 * after mount and owns the metric tiles, the booking list, the calendar/wallet
 * sidebar and the loading, signed-out and error states. There is no demo data:
 * an unauthenticated visitor sees a sign-in prompt rather than fabricated
 * bookings.
 */
export default async function DashboardPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col bg-mist text-ink">
      <MarketplaceHeader currentTab="classes" />
      <main className="flex-1">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8">
          <DashboardHeader />
          <DashboardShell initial={null} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
