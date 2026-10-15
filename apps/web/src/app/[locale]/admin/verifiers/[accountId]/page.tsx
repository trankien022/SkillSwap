import { setRequestLocale } from 'next-intl/server';
import { VerifierStatusPage } from '../../../../../components/admin/VerifierStatusPage';
import { SiteFooter } from '../../../../../components/landing/SiteFooter';
import { Navbar } from '../../../../../components/navbar';

type PageProps = {
  params: Promise<{ locale: string; accountId: string }>;
};

/**
 * Admin control for one Verifier account (FR-004 / ADR-027).
 *
 * The session token lives in `localStorage` (see `api-client.ts`), so role
 * gating can only happen on the client. The server component therefore only
 * sets the locale and hands off to a client component that loads `/auth/me`
 * after mount and either shows the form (admin), the not-authorized banner
 * (non-admin), or a sign-in prompt (anonymous).
 *
 * The backend `POST /verifiers/{accountId}/status` is also `@Roles('admin')`,
 * so even if a non-admin bypasses the client gate, the API returns 403 and
 * the form renders the translated `forbidden` message.
 *
 * Chrome (navbar + footer) is rendered here rather than inside the client
 * component: this is an auth-only deep link (audit log, email, notification),
 * so without it the screen had no brand, no route back and no sign-out.
 */
export default async function AdminVerifierPage({ params }: PageProps) {
  const { locale, accountId } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar currentTab="admin" />
      <div className="flex-1">
        <VerifierStatusPage accountId={accountId} />
      </div>
      <SiteFooter />
    </div>
  );
}
