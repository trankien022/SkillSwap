import { setRequestLocale } from 'next-intl/server';
import { MarketplaceHeader } from '../../../../../components/marketplace/MarketplaceHeader';
import { SiteFooter } from '../../../../../components/landing/SiteFooter';
import { LiveClassroomContent } from '../../../../../components/classroom/LiveClassroomContent';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

/**
 * Dedicated In-app Live Classroom Workspace (FR-011 live Jitsi integration,
 * FR-038 escrow held status, E2E secure peer tutoring).
 */
export default async function BookingLiveClassroomPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <MarketplaceHeader currentTab="classes" />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <LiveClassroomContent bookingId={id} roomCode={id} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
