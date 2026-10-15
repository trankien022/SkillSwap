import { setRequestLocale } from 'next-intl/server';
import { MarketplaceHeader } from '../../../../components/marketplace/MarketplaceHeader';
import { ClassDetailContent } from '../../../../components/marketplace/ClassDetailContent';
import { SiteFooter } from '../../../../components/landing/SiteFooter';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

/**
 * Class detail page (FR-006 detail).
 *
 * Server component. Renders the chrome and mounts the client
 * `ClassDetailContent` shell, which fetches the class from the live API
 * after mount (the endpoint is authenticated). Re-uses `MarketplaceHeader`
 * and `SiteFooter` for chrome consistency with the marketplace list.
 */
export default async function ClassDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col bg-mist text-ink">
      <MarketplaceHeader />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className="workspace-page">
          <ClassDetailContent id={id} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}