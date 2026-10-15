import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ClientEntry } from '../../../../components/admin/StudentVerificationClientEntry';
import { SiteFooter } from '../../../../components/landing/SiteFooter';
import { Navbar } from '../../../../components/navbar';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
};

/**
 * Auth-only admin index. Two things were wrong before:
 *   1. The copy was hardcoded English on both locales (locale bleed).
 *   2. There was no chrome, so the deep-link entry screen had no brand and no
 *      route back.
 * The `Admin.StudentVerification` namespace already existed for the review
 * screen, so the index now reads its title/notice from it.
 *
 * `?status=` seeds the queue's status filter, so the dashboard's
 * "verifications awaiting review" count opens the exact list it counted. Only the
 * four known statuses are accepted; anything else is ignored rather than forwarded,
 * because a stray value would 400 the queue's own contract.
 */
export default async function AdminStudentVerificationsIndex({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('Admin.StudentVerification');

  const initialStatus = (['pending', 'approved', 'rejected', 'revoked'] as const).find(
    (known) => known === status,
  );

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">{t('title')}</h1>
        <p className="text-sm text-slate-600 mb-4">{t('notice')}</p>

        <ClientEntry initialStatus={initialStatus ?? ''} />
      </main>
      <SiteFooter />
    </div>
  );
}
