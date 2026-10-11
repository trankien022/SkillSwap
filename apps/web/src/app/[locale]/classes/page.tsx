import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MarketplaceHeader } from '../../../components/marketplace/MarketplaceHeader';
import { MarketplaceClient } from '../../../components/marketplace/MarketplaceClient';
import { EscrowBanner } from '../../../components/marketplace/EscrowBanner';
import { SiteFooter } from '../../../components/landing/SiteFooter';
import { DEFAULT_QUERY, MockMarketplaceGateway } from '../../../lib/marketplace/mock-gateway';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Marketplace browse page (FR-006).
 *
 * Server component fetches the first page through the gateway and passes
 * it to the client shell. Auth-aware chrome (balance, role toggle, school
 * pill) is rendered by `MarketplaceHeader` only when a real session
 * exists — for the pilot it is hidden.
 */
export default async function MarketplacePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Touch the namespace so messages-parity still finds the keys at build time.
  await getTranslations('Marketplace.search');
  const gateway = new MockMarketplaceGateway();
  const initialPage = await gateway.search({ ...DEFAULT_QUERY, page: 1 });

  return (
    <div className="flex min-h-dvh flex-col bg-mist text-ink">
      <MarketplaceHeader />
      <main className="flex-1">
        <MarketplaceClient initialPage={initialPage} />
        <EscrowBanner />
      </main>
      <SiteFooter />
    </div>
  );
}