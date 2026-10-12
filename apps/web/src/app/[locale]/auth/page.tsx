import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-14">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-100" />}>
          <AuthForm initialTab={initialTab} locale={locale} />
        </Suspense>
      </main>

      <SiteFooter />
    </div>
  );
}
