import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AuditLog } from '../../../../components/admin/AuditLog';
import { SiteFooter } from '../../../../components/landing/SiteFooter';
import { Navbar } from '../../../../components/navbar';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * FR-015 / W3: the admin audit log.
 *
 * Chrome lives here and the role gate lives in the client component, matching the
 * other admin routes: the session token is in `localStorage`, so it cannot be read
 * until after mount, while the locale is a server concern.
 *
 * The API is also `@Roles('admin')`, so a non-admin who never renders the client
 * gate still gets a 403 rather than data.
 */
export default async function AuditLogPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Admin.auditLog');

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 lg:px-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">{t('pageTitle')}</h1>
          <p className="text-sm leading-relaxed text-slate-600">{t('pageSubtitle')}</p>
        </header>
        <AuditLog />
      </main>
      <SiteFooter />
    </div>
  );
}
