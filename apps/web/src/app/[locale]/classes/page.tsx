import { catalogueCategory } from '../../../lib/marketplace/category';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MarketplaceHeader } from '../../../components/marketplace/MarketplaceHeader';
import { MarketplaceClient } from '../../../components/marketplace/MarketplaceClient';
import { EscrowBanner } from '../../../components/marketplace/EscrowBanner';
import { SiteFooter } from '../../../components/landing/SiteFooter';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string | string[] }>;
};

/**
 * Marketplace browse page (FR-006).
 *
 * Server component renders the chrome and mounts the client shell, which
 * fetches the first page from the live API after mount. `GET /classes` is
 * authenticated, so the read cannot happen on the server — the bearer token
 * lives in the browser. Auth-aware chrome (balance, role toggle, school pill)
 * is rendered by `MarketplaceHeader` only when a real session exists.
 */
export default async function MarketplacePage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const initialCategory = catalogueCategory((await searchParams).category);
  // Touch the namespace so messages-parity still finds the keys at build time.
  await getTranslations('Marketplace.search');

  return (
    <div className="flex min-h-dvh flex-col bg-mist text-ink">
      <MarketplaceHeader />
      <main className="flex-1">
        <MarketplaceClient initialCategory={initialCategory} />
        <EscrowBanner />
      </main>
      <SiteFooter />
    </div>
  );
}
