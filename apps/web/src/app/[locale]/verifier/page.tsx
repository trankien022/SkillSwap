import { setRequestLocale } from 'next-intl/server';
import { VerifierQueuePage } from '../../../components/verifier-queue';
import { SiteFooter } from '../../../components/landing/SiteFooter';
import { Navbar } from '../../../components/navbar';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function VerifierPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* This screen is only reachable with a session, so it previously rendered
          with no chrome at all: no brand, no way back, no sign-out. */}
      <Navbar currentTab="verifier" />
      <VerifierQueuePage />
      <SiteFooter />
    </div>
  );
}
