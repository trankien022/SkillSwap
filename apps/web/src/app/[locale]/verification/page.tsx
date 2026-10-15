import { setRequestLocale } from 'next-intl/server';
import { SiteFooter } from '../../../components/landing/SiteFooter';
import { VerificationContent } from '../../../components/verification/VerificationContent';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/** Student information and manually reviewed verification evidence. */
export default async function VerificationPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <VerificationContent />
      <SiteFooter />
    </div>
  );
}
