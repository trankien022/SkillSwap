import { setRequestLocale } from 'next-intl/server';
import { MarketplaceHeader } from '../../../../components/marketplace/MarketplaceHeader';
import { SiteFooter } from '../../../../components/landing/SiteFooter';
import { PostSessionReviewContent } from '../../../../components/dashboard/PostSessionReviewContent';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Fallback static review page for direct navigation or preview.
 */
export default async function DefaultBookingReviewPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <MarketplaceHeader currentTab="classes" />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <PostSessionReviewContent bookingId="SS-VN-8821" />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
