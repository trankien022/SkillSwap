import { setRequestLocale } from 'next-intl/server';
import { MarketplaceHeader } from '../../../../../components/marketplace/MarketplaceHeader';
import { SiteFooter } from '../../../../../components/landing/SiteFooter';
import { PostSessionReviewContent } from '../../../../../components/dashboard/PostSessionReviewContent';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

/**
 * Post-session settlement and peer review page (FR-013 review, FR-038 escrow
 * release).
 *
 * The booking id comes from the route; the client component resolves it against
 * the learner's own bookings, so the server component only renders the chrome.
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
