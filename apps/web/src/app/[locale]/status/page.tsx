import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Navbar } from '../../../components/navbar';
import { SiteFooter } from '../../../components/landing/SiteFooter';
import { PageIntro } from '../../../components/ui/PageIntro';
import { StatusCheck } from '../../../components/status-check';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function StatusPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Status');

  return (
    <div className="flex min-h-dvh flex-col bg-mist text-ink">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="workspace-page workspace-page-narrow flex-1">
        <PageIntro title={t('title')} description={t('description')} />
        <StatusCheck />
      </main>
      <SiteFooter />
    </div>
  );
}
