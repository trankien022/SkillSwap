import { PageIntro } from '../../../../components/ui/PageIntro';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ClientEntry } from '../../../../components/admin/StudentVerificationClientEntry';
import { SiteFooter } from '../../../../components/landing/SiteFooter';
import { Navbar } from '../../../../components/navbar';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Auth-only admin index. Two things were wrong before:
 *   1. The copy was hardcoded English on both locales (locale bleed).
 *   2. There was no chrome, so the deep-link entry screen had no brand and no
 *      route back.
 * The `Admin.StudentVerification` namespace already existed for the review
 * screen, so the index now reads its title/notice from it.
 */
export default async function AdminStudentVerificationsIndex({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin.StudentVerification');

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar currentTab="admin" />
      <main id="main-content" tabIndex={-1} className="workspace-page workspace-page-narrow flex-1">
        <PageIntro title={t('title')} description={t('notice')} />

        <ClientEntry />
      </main>
      <SiteFooter />
    </div>
  );
}
