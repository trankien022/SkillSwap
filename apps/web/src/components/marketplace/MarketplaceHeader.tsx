import { getTranslations } from 'next-intl/server';
import { Navbar, type NavbarTab } from '../navbar';

/**
 * Marketplace header harmonized with SkillSwap unified Navbar.
 * Displays live wallet balance, notification stream, student identity,
 * and seamless navigation across Marketplace, Bookings, Teaching, and Wallet.
 */
export async function MarketplaceHeader({ currentTab = 'explore' }: { currentTab?: NavbarTab }) {
  // Touch namespace for messages parity
  await getTranslations('Marketplace.nav');
  return <Navbar currentTab={currentTab} />;
}