'use client';

import { PageIntro } from '../ui/PageIntro';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { getMe, type UserProfile } from '../../lib/api-client';
import { AdminDashboard } from './AdminDashboard';

/**
 * Role-gated admin home (round-2 plan §4.1, extended by FR-015 / W4).
 *
 * Render states, ordered by the data actually held:
 *   1. `loading`   — `/auth/me` is in flight. Brief, no CTA.
 *   2. `signed-out`— no session; sign-in keeps the deep link as `returnUrl`.
 *   3. non-admin   — the translated forbidden banner (the client check is
 *                    best-effort; each admin route re-checks server-side).
 *   4. admin       — the operations dashboard, then links to the three operations
 *                    surfaces that exist, then the by-account-id Verifier control.
 *
 * The earlier "not ready" banner is gone because it is no longer true: the pending
 * queue, the Verifier queue and the audit log all exist now, and a screen that says
 * they do not is a lie an operator has to work around. Every card here links to a
 * route that renders real data.
 *
 * The by-id Verifier control is **kept** alongside the queue, not replaced: the deep
 * link is still reached from an email or a shared message, and removing the way to
 * use it would break a path people already follow. It is now the fallback rather
 * than the only option.
 */
export function AdminLanding() {
  const t = useTranslations('Admin.Landing');
  const tVerifiers = useTranslations('Admin.verifiers');
  const tVerifierQueue = useTranslations('Admin.verifierQueue');
  const tAudit = useTranslations('Admin.auditLog');
  const tStudent = useTranslations('Admin.StudentVerification');
  const locale = useLocale();
  const router = useRouter();

  const [phase, setPhase] = useState<'loading' | 'signed-out' | 'ready'>('loading');
  const [isAdmin, setIsAdmin] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [accountIdError, setAccountIdError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me: UserProfile | null = await getMe();
      if (cancelled) return;
      if (me === null) {
        setPhase('signed-out');
        return;
      }
      setIsAdmin(me.role === 'admin');
      setPhase('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (phase === 'loading') {
    return (
      <main id="main-content" tabIndex={-1} className="workspace-page workspace-page-narrow flex-1">
        <p data-testid="admin-landing-loading">{tVerifiers('loading')}</p>
      </main>
    );
  }

  if (phase === 'signed-out') {
    const returnUrl = encodeURIComponent(`/${locale}/admin`);
    return (
      <main id="main-content" tabIndex={-1} className="workspace-page workspace-page-narrow flex-1">
        <h1 className="text-2xl font-bold text-slate-900">{tVerifiers('signInTitle')}</h1>
        <p className="text-sm leading-relaxed text-slate-600">{tVerifiers('signInBody')}</p>
        <a
          href={`/${locale}/auth?tab=login&returnUrl=${returnUrl}`}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-campus-emerald-deep px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink"
        >
          {tVerifiers('signInCta')}
        </a>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main id="main-content" tabIndex={-1} className="workspace-page workspace-page-narrow flex-1">
        <h1 className="text-2xl font-bold text-slate-900">{tVerifiers('notAuthorizedTitle')}</h1>
        <p className="text-sm leading-relaxed text-slate-600">{tVerifiers('notAuthorizedBody')}</p>
      </main>
    );
  }

  const openVerifierStatus = (e: React.FormEvent) => {
    e.preventDefault();
    const id = accountId.trim();
    if (!id) {
      setAccountIdError(true);
      return;
    }
    setAccountIdError(false);
    router.push(`/${locale}/admin/verifiers/${encodeURIComponent(id)}`);
  };

  return (
    <main id="main-content" tabIndex={-1} className="workspace-page workspace-page-narrow flex-1">
      <PageIntro title={t('title')} description={t('subtitle')} />

      <AdminDashboard />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-700">{t('toolsTitle')}</h2>

        <a
          href={`/${locale}/operations`}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300"
        >
          <h3 className="text-sm font-semibold text-slate-900">{t('operations')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{t('operationsBody')}</p>
        </a>

        <a
          href={`/${locale}/admin/student-verifications`}
          className="rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-emerald-300"
        >
          <h3 className="text-sm font-semibold text-slate-900">{t('studentVerifications')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{tStudent('queueNotice')}</p>
        </a>

        <a
          href={`/${locale}/admin/verifiers`}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300"
        >
          <h3 className="text-sm font-semibold text-slate-900">{tVerifierQueue('pageTitle')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {tVerifierQueue('pageSubtitle')}
          </p>
        </a>

        <a
          href={`/${locale}/admin/audit-log`}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300"
        >
          <h3 className="text-sm font-semibold text-slate-900">{tAudit('pageTitle')}</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{tAudit('pageSubtitle')}</p>
        </a>
      </section>

      <section className="flex flex-col gap-3">
        <form onSubmit={openVerifierStatus} className="workspace-panel">
          <h2 className="text-sm font-semibold text-slate-900">{t('verifierStatus')}</h2>
          {/* Kept as the fallback for a deep link that arrives from an email or a shared
              message; the queue above is now the normal way in. */}
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {tVerifiers('accountIdHint')}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                if (accountIdError) setAccountIdError(false);
              }}
              placeholder={t('accountIdPlaceholder')}
              aria-label={tVerifiers('accountIdLabel')}
              className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-ink-muted focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-campus-emerald-deep px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink"
            >
              {t('openCta')}
            </button>
          </div>
          {accountIdError && (
            <p role="alert" className="mt-2 text-sm font-medium text-rose-600">
              {t('accountIdRequired')}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
