import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '../../../i18n/routing';
import { Suspense } from 'react';
import { BrandMark } from '../../../components/BrandMark';
import { SiteFooter } from '../../../components/landing/SiteFooter';
import { AuthForm } from '../../../components/auth/AuthForm';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; returnUrl?: string }>;
};

export default async function AuthPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { tab } = await searchParams;
  setRequestLocale(locale);

  // Statically track Auth namespace for messages-parity
  await getTranslations('Auth');

  const initialTab = tab === 'login' ? 'login' : 'register';

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 selection:bg-emerald-100 selection:text-emerald-800">
      {/* Brand-only header. This page had the full authenticated Navbar, which
          offered a signed-out visitor "My Bookings / Teaching / Wallet" (all
          401), a credits pill and a bell, while rendering the signed-in shape
          for anyone arriving with a stale token. The auth page has exactly one
          job, so it now shows the brand and nothing else — no nav items at all. */}
      <header className="sticky top-0 z-50 h-16 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
          <Link
            href="/"
            aria-label="SkillSwap"
            className="flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
          >
            <BrandMark />
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-14">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-100" />}>
          <AuthForm initialTab={initialTab} locale={locale} />
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
}
