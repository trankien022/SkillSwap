import { setRequestLocale } from 'next-intl/server';
import { MarketplaceHeader } from '../../../../components/marketplace/MarketplaceHeader';
import { SiteFooter } from '../../../../components/landing/SiteFooter';
import { LiveClassroomContent } from '../../../../components/classroom/LiveClassroomContent';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Fallback static live classroom route for preview or direct navigation.
 */
export default async function DefaultBookingLiveClassroomPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <MarketplaceHeader currentTab="classes" />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <LiveClassroomContent bookingId="SS-VN-8821" roomCode="SS-VN-8821" />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
