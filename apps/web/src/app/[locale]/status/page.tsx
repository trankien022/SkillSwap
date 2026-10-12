import { getTranslations, setRequestLocale } from 'next-intl/server';
import VerificationPage from '../verification/page';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function StatusPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  await getTranslations('Status');

  // Render the verification client page in place of the system status page.
  // The VerificationPage component fetches from /api/student-verification/status
  // and falls back to a local mock when the API is unreachable.
  return <VerificationPage />;
}
