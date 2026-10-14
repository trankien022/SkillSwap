import { setRequestLocale } from 'next-intl/server';
import { VerifierQueuePage } from '../../../components/verifier-queue';
import { SiteFooter } from '../../../components/landing/SiteFooter';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function VerifierPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <VerifierQueuePage />
      <SiteFooter />
    </div>
  );
}
