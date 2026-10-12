import { setRequestLocale } from 'next-intl/server';
import { SiteFooter } from '../../../components/landing/SiteFooter';
import { VerificationContent } from '../../../components/verification/VerificationContent';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Student Verification Center page (FR-004 student verification,
 * FR-005 skill verification).
 *
 * Displays:
 * 1. Verified student identification card & university affiliation
 * 2. Watermarked student card scan with secure internal masking
 * 3. Academic Trust Index gauge & peer endorsements
 * 4. Certified subject credentials
 * 5. SkillSwap safety and privacy pledge
 */
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
