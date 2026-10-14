import { setRequestLocale } from 'next-intl/server';
import { StudentVerificationReview } from '../../../../../components/admin/StudentVerificationReview';
import { SiteFooter } from '../../../../../components/landing/SiteFooter';

type PageProps = {
  params: Promise<{ locale: string; verificationId: string }>;
};

export default async function ReviewByIdPage({ params }: PageProps) {
  const { locale, verificationId } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Client-side review component */}
      <StudentVerificationReview verificationId={verificationId} />
      <SiteFooter />
    </div>
  );
}
