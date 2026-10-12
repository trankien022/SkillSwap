import { setRequestLocale } from 'next-intl/server';
import { MarketplaceHeader } from '../../../../../components/marketplace/MarketplaceHeader';
import { SiteFooter } from '../../../../../components/landing/SiteFooter';
import { PostSessionReviewContent } from '../../../../../components/dashboard/PostSessionReviewContent';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

/**
 * Post-session settlement and peer review page (FR-013 peer review rating,
 * FR-038 escrow release, post-Jitsi milestone).
 *
 * Displays:
 * 1. 3-step progress stepper (Leave Jitsi -> Escrow Settlement -> Peer Rating)
 * 2. Celebration completion banner with session code
 * 3. Left column: Session dossier, 90/10 escrow settlement breakdown, notes download
 * 4. Right column: 4-criteria rating, suggestion chips, skill-swap cross-matching
 */
export default async function BookingReviewPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <MarketplaceHeader currentTab="classes" />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <PostSessionReviewContent bookingId={id} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
