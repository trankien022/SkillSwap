'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { getMe, type UserProfile } from '../../lib/api-client';

/**
 * Role-gated admin home (round-2 plan §4.1).
 *
 * Render states, ordered by the data actually held:
 *   1. `loading`   — `/auth/me` is in flight. Brief, no CTA.
 *   2. `signed-out`— no session; sign-in keeps the deep link as `returnUrl`.
 *   3. non-admin   — the translated forbidden banner (the client check is
 *                    best-effort; each admin route re-checks server-side).
 *   4. admin       — only links to routes that exist *today*:
 *                      · `/admin/student-verifications` (works now)
 *                      · verifier status by account id (works now, and the
 *                        copy states plainly that no verifier list exists)
 *                    The pending queue / verifier list / audit log are NOT
 *                    linked — they do not exist yet and a link would be a
 *                    dead end (no fabricated navigation).
 */
export function AdminLanding() {
  const t = useTranslations('Admin.Landing');
  const tVerifiers = useTranslations('Admin.verifiers');
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
      <main id="main-content" tabIndex={-1} className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-12 text-sm text-slate-600">
        <p data-testid="admin-landing-loading">{tVerifiers('loading')}</p>
      </main>
    );
  }

  if (phase === 'signed-out') {
    const returnUrl = encodeURIComponent(`/${locale}/admin`);
    return (
      <main id="main-content" tabIndex={-1} className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-12">
        <h1 className="text-2xl font-bold text-slate-900">{tVerifiers('signInTitle')}</h1>
        <p className="text-sm leading-relaxed text-slate-600">{tVerifiers('signInBody')}</p>
        <a
          href={`/${locale}/auth?tab=login&returnUrl=${returnUrl}`}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          {tVerifiers('signInCta')}
        </a>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main id="main-content" tabIndex={-1} className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-12">
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
    <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">{t('title')}</h1>
        <p className="text-sm text-slate-600">{t('subtitle')}</p>
      </header>

      <section className="flex flex-col gap-3">
        <a
          href={`/${locale}/admin/student-verifications`}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300"
        >
          <h2 className="text-sm font-semibold text-slate-900">{t('studentVerifications')}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{tStudent('notice')}</p>
        </a>

        <form
          onSubmit={openVerifierStatus}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-slate-900">{t('verifierStatus')}</h2>
          {/* The lack of a verifier list is stated, not hidden: the admin has
              to arrive from an email/deep link, and pretending a list exists
              would be a fabrication. */}
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
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
              className="block w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              {t('openCta')}
            </button>
          </div>
          {accountIdError && (
            <p role="alert" className="mt-2 text-xs font-medium text-rose-600">
              {t('accountIdRequired')}
            </p>
          )}
        </form>
      </section>

      {/* Honest boundary: these screens do not exist yet, so no link is
          offered for them. Copy states it plainly (no requirement IDs in UI). */}
      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-100/60 p-5">
        <h2 className="text-sm font-semibold text-slate-700">{t('notReadyTitle')}</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{t('notReadyBody')}</p>
      </section>
    </main>
  );
}
