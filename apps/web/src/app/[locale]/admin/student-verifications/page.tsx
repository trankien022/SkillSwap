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
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">{t('title')}</h1>
        <p className="text-sm text-slate-600 mb-4">{t('notice')}</p>

        <ClientEntry />
      </main>
      <SiteFooter />
    </div>
  );
}
