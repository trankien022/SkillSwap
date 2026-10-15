'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getMe } from '../../lib/api-client';
import { VerifierStatusForm } from './VerifierStatusForm';

/**
 * Client-side wrapper for the admin Verifier control (TASK-03 Phase 1).
 *
 * Three render states, ordered by the data we actually have:
 *   1. `loading` — `getMe()` is in flight (or unreachable). Brief, no CTA.
 *   2. `signed-out` — no session at all. Offer a sign-in link.
 *   3. `ready` (admin) — render `VerifierStatusForm`.
 *   4. `ready` (non-admin) — render the `notAuthorized` banner.
 *
 * The `me.role` check is best-effort: a 401 from the form's POST is the
 * server's source of truth. The page intentionally **does not** retry or
 * auto-replay the role check.
 */
export function VerifierStatusPage({ accountId }: { accountId: string }) {
  const t = useTranslations('Admin.verifiers');
  const locale = useLocale();

  const [phase, setPhase] = useState<'loading' | 'signed-out' | 'ready'>('loading');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await getMe();
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
      <main className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-12 text-sm text-ink-soft">
        <p data-testid="admin-verifier-loading">{t('loading')}</p>
      </main>
    );
  }

  if (phase === 'signed-out') {
    // The CTA used to be a bare `href="#sign-in"` — there is no `#sign-in`
    // anchor anywhere, so it was a no-op that looked like a working link.
    // Point it at the real auth page and preserve the deep link as `returnUrl`,
    // the same contract LandingAuthAction uses (locale-explicit, because
    // returnUrl is not passed through next-intl's Link).
    const returnUrl = encodeURIComponent(
      `/${locale}/admin/verifiers/${encodeURIComponent(accountId)}`,
    );
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-12">
        <h1 className="text-2xl font-bold text-ink">{t('signInTitle')}</h1>
        <p className="text-sm leading-relaxed text-ink-soft">{t('signInBody')}</p>
        <a
          href={`/${locale}/auth?tab=login&returnUrl=${returnUrl}`}
          className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-[0.99]"
        >
          {/* Was `tRoot('signIn')`, but there is no root-level `signIn` key, so
              this rendered the literal string "signIn". */}
          {t('signInCta')}
        </a>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-12">
        <h1 className="text-2xl font-bold text-ink">{t('notAuthorizedTitle')}</h1>
        <p className="text-sm leading-relaxed text-ink-soft">{t('notAuthorizedBody')}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-8">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {t('breadcrumb')}
        </span>
        <h1 className="text-2xl font-bold text-ink">{t('pageTitle')}</h1>
        <p className="text-sm text-ink-soft">{t('pageSubtitle')}</p>
      </header>
      <VerifierStatusForm accountId={accountId} initial={null} />
    </main>
  );
}
