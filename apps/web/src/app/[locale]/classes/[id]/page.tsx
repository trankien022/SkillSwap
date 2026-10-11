import { setRequestLocale } from 'next-intl/server';
import { MarketplaceHeader } from '../../../../components/marketplace/MarketplaceHeader';
import { ClassDetailContent } from '../../../../components/marketplace/ClassDetailContent';
import { SiteFooter } from '../../../../components/landing/SiteFooter';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

/**
 * Class detail page (FR-006 detail, mock layer).
 *
 * Server component. Fetches the detail view through the gateway
 * (mock today) and composes the page. Re-uses `MarketplaceHeader` and
 * `SiteFooter` for chrome consistency with the marketplace list.
 */
export default async function ClassDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col bg-mist text-ink">
      <MarketplaceHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <ClassDetailContent id={id} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}