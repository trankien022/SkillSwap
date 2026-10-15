import { setRequestLocale } from 'next-intl/server';
import { StudentVerificationReview } from '../../../../../components/admin/StudentVerificationReview';
import { SiteFooter } from '../../../../../components/landing/SiteFooter';
import { Navbar } from '../../../../../components/navbar';

type PageProps = {
  params: Promise<{ locale: string; verificationId: string }>;
};

export default async function ReviewByIdPage({ params }: PageProps) {
  const { locale, verificationId } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Auth-only deep link: without the navbar this screen had no brand, no
          route back and no sign-out. */}
      <Navbar currentTab="admin" />
      {/* Client-side review component */}
      <main id="main-content" tabIndex={-1} className="workspace-page workspace-page-narrow flex-1">
        <StudentVerificationReview verificationId={verificationId} />
      </main>
      <SiteFooter />
    </div>
  );
}
