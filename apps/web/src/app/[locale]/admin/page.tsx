import { setRequestLocale } from 'next-intl/server';
import { AdminLanding } from '../../../components/admin/AdminLanding';
import { SiteFooter } from '../../../components/landing/SiteFooter';
import { Navbar } from '../../../components/navbar';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Admin landing (round-2 plan D1).
 *
 * There was no `/admin` index at all: after signing in, an admin was sent to
 * `/classes` and the only admin screens were deep links you had to already
 * know. The chrome mirrors `/verifier`; `AdminLanding` owns the role gate.
 */
export default async function AdminLandingPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <AdminLanding />
      <SiteFooter />
    </div>
  );
}
