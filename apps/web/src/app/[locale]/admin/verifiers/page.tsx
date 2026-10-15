import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminVerifierQueue } from '../../../../components/admin/AdminVerifierQueue';
import { SiteFooter } from '../../../../components/landing/SiteFooter';
import { Navbar } from '../../../../components/navbar';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ domain?: string }>;
};

/**
 * FR-015 / W2: the admin-wide Verifier queue, by domain.
 *
 * Separate from `/[locale]/verifier` on purpose. That page is a Verifier's own
 * expertise-scoped queue; this one is the administrator's unscoped view, and
 * merging them would mean one screen whose contents depend on who is looking at
 * it — the thing that makes an operations view untrustworthy.
 *
 * `?domain=` seeds the domain filter, so a dashboard backlog row opens the queue it
 * counted. The value is passed through as-is: the queue's contract already bounds
 * it (`min(2).max(80)`), and a value outside that is dropped by the client rather
 * than sent, so a stray param cannot 400 the page.
 *
 * Chrome is rendered here rather than in the client component, matching the
 * other admin routes: the client component owns the role gate (the token lives
 * in `localStorage`, so it can only be read after mount) and the server owns the
 * locale.
 */
export default async function AdminVerifierQueuePage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { domain } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('Admin.verifierQueue');

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 lg:px-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">{t('pageTitle')}</h1>
          <p className="text-sm leading-relaxed text-slate-600">{t('pageSubtitle')}</p>
        </header>
        <AdminVerifierQueue initialDomain={domain ?? ''} />
      </main>
      <SiteFooter />
    </div>
  );
}
