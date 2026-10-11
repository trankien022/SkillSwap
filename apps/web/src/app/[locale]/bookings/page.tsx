import { setRequestLocale } from 'next-intl/server';
import { MarketplaceHeader } from '../../../components/marketplace/MarketplaceHeader';
import { SiteFooter } from '../../../components/landing/SiteFooter';
import { DashboardHeader, MetricTiles } from '../../../components/dashboard/DashboardHeader';
import { DashboardShell } from '../../../components/dashboard/DashboardShell';
import { RightSidebar } from '../../../components/dashboard/RightSidebar';
import { MockLearnerDashboardGateway } from '../../../lib/dashboard/mock-gateway';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Learner dashboard page (FR-021 booking lifecycle, FR-013 review,
 * FR-038 escrow release). Server component. Fetches the snapshot
 * through the gateway (mock today) and composes the page.
 * Re-uses `MarketplaceHeader` and `SiteFooter` for chrome.
 */
export default async function DashboardPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const gateway = new MockLearnerDashboardGateway();
  const snapshot = await gateway.getSnapshot();
  const isAuthed = gateway.isAuthenticated();
  const now = new Date();

  return (
    <div className="flex min-h-dvh flex-col bg-mist text-ink">
      <MarketplaceHeader />
      <main className="flex-1">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8">
          <DashboardHeader />
          <MetricTiles metrics={snapshot.metrics} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="flex flex-col gap-6 lg:col-span-8">
              <DashboardShell
                initial={snapshot}
                calendar={snapshot.calendar}
                charter={snapshot.charter}
                isAuthed={isAuthed}
              />
            </div>
            <div className="lg:col-span-4">
              <RightSidebar
                month={now.getUTCMonth()}
                year={now.getUTCFullYear()}
                days={snapshot.calendar}
                wallet={snapshot.wallet}
                charter={snapshot.charter}
                isAuthed={isAuthed}
              />
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
