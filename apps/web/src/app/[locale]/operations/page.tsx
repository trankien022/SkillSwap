import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminDashboard } from '../../../components/admin/AdminDashboard';
import { SuspendedAccountsSection } from '../../../components/admin/SuspendedAccountsPanel';
import { SiteFooter } from '../../../components/landing/SiteFooter';
import { Navbar } from '../../../components/navbar';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * FR-015 / AC-031 / AC-033 / ADR-037: the operations screen.
 *
 * This is S17 in the SRS. Before it there was no web route that put the operator's
 * day on one page: the dashboard was reachable only as a block inside `/admin`, the
 * queue and the audit log were separate routes, and the account lock had no screen
 * at all.
 *
 * The four panels are the same components the dedicated routes render, not copies.
 * A second implementation of the verification queue would eventually disagree with
 * the first, and the operator would have no way to tell which one was lying.
 *
 * Chrome lives here and the role gate lives in each client component, matching the
 * other admin routes: the session token is in `localStorage`, so it cannot be read
 * until after mount, while the locale is a server concern. Every API call behind
 * these panels is `@Roles('admin')`, so a non-admin who never renders the gate still
 * gets a 403 rather than data — and each panel renders a permission message rather
 * than an empty list (AC-033).
 *
 * There is deliberately **no lock form for a Verifier** here: `POST
 * /verifiers/{id}/status` is a different act with its own screen at
 * `/admin/verifiers`, and merging the two would suggest one status field governs both.
 */
export default async function OperationsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin.operations');

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar currentTab="admin" />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 lg:px-8"
      >
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">{t('pageTitle')}</h1>
          <p className="text-sm leading-relaxed text-slate-600">{t('pageSubtitle')}</p>
        </header>

        <AdminDashboard />

        <SuspendedAccountsSection />
      </main>
      <SiteFooter />
    </div>
  );
}
