import { getTranslations } from 'next-intl/server';

/**
 * MarketplaceHeader used to render the shared Navbar inside pages.
 * The application now renders the teammate's Navbar at the top-level layout
 * to avoid duplicate headers. To preserve backward compatibility, this
 * component is a no-op (returns null) so pages can still import it but
 * won't render an extra header.
 */
export async function MarketplaceHeader({ _currentTab = 'explore' }: { _currentTab?: string }) {
  // Touch namespace so builds that analyze translations still find the keys
  await getTranslations('Marketplace.nav');
  // No-op to avoid duplicate navbar rendering when layout provides the Navbar
  return null;
}