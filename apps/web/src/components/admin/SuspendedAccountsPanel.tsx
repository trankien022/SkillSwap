'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { SuspendedAccountView } from '@skillswap/contracts';
import { AdminAuthError, HttpVerificationGateway } from '../../lib/verification/http-gateway';
import { SuspendAccountForm } from './SuspendAccountForm';

/**
 * FR-015 / OQ-015 / ADR-037: the account-lock list.
 *
 * Three states, and the distinction between the last two is the point (AC-033):
 *
 * 1. **ready, empty** — "nobody is locked". A real answer, reachable only after the
 *    API said so.
 * 2. **ready, rows** — the list, each row carrying the reason and who applied it,
 *    because a lock an Administrator cannot explain is one they cannot review.
 * 3. **unauthorized** — a permission message. **Never an empty list.** A non-admin
 *    who saw "no suspended accounts" would have been told a reassuring falsehood,
 *    so the 401/403 path is a different rendering entirely, not a filtered one.
 *
 * Release is the action that matters on this screen: it is the only way out of a
 * lock that does not require the database. It asks for confirmation in place
 * rather than opening a dialog, and it does **not** ask for a reason — ADR-037
 * decision 2 rejects a reason on a release, so a form field for one would be a
 * trap for whoever filled it in.
 */

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: SuspendedAccountView[]; total: number }
  | { kind: 'unauthorized' }
  | { kind: 'failed'; message: string };

/**
 * FR-015 / OQ-015 / ADR-037: the account-lock list and the form that adds to it.
 *
 * The list reloads from the server after a lock or a release rather than splicing a
 * row in or out locally: this panel is the record of who is locked, and a local edit
 * would show a state the server has not confirmed for every other reader.
 *
 * `reloadKey` is a counter, not a boolean, so two acts in a row both trigger a load.
 */
export function SuspendedAccountsSection() {
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <section className="flex flex-col gap-4">
      <SuspendAccountForm onSuspended={() => setReloadKey((n) => n + 1)} />
      <SuspendedAccountsPanel reloadKey={reloadKey} />
    </section>
  );
}

export function SuspendedAccountsPanel({ reloadKey = 0 }: { reloadKey?: number }) {
  const t = useTranslations('Admin.suspendedAccounts');
  const locale = useLocale();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    setReleaseError(null);
    try {
      const page = await new HttpVerificationGateway().listSuspendedAccounts({ limit: 50 });
      setState({ kind: 'ready', items: page.items, total: page.page.total });
    } catch (error) {
      if (error instanceof AdminAuthError) {
        setState({ kind: 'unauthorized' });
        return;
      }
      setState({
        kind: 'failed',
        message: error instanceof Error ? error.message : t('errors.generic'),
      });
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const release = useCallback(
    async (accountId: string) => {
      setReleasing(accountId);
      setReleaseError(null);
      try {
        await new HttpVerificationGateway().reinstateAccount(accountId);
        setPendingId(null);
        // Reload rather than splicing the row out locally: the list is the record of
        // who is locked, and a client-side removal would show a state the server has
        // not confirmed for every other reader.
        await load();
      } catch (error) {
        if (error instanceof AdminAuthError) {
          setState({ kind: 'unauthorized' });
          return;
        }
        setReleaseError(error instanceof Error ? error.message : t('errors.release'));
      }
    },
    [load, t],
  );

  if (state.kind === 'unauthorized') {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">{t('unauthorizedTitle')}</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">{t('unauthorizedBody')}</p>
      </section>
    );
  }

  if (state.kind === 'failed') {
    return (
      <section
        role="alert"
        className="rounded-2xl border border-rose-200 bg-rose-50 p-4"
        data-testid="suspended-accounts-failed"
      >
        <p className="text-sm font-medium text-rose-800">{t('errors.generic')}</p>
        <p className="mt-1 text-xs text-rose-700">{state.message}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-full bg-rose-700 px-4 py-1.5 text-xs font-semibold text-white"
        >
          {t('retry')}
        </button>
      </section>
    );
  }

  if (state.kind === 'loading') {
    return (
      <p className="text-sm text-slate-600" data-testid="suspended-accounts-loading">
        {t('loading')}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-4" data-testid="suspended-accounts">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-slate-900">{t('title')}</h2>
        <p className="text-xs leading-relaxed text-slate-600">{t('subtitle')}</p>
        {state.total > state.items.length && (
          <p className="text-xs text-slate-500">{t('showing', { shown: state.items.length, total: state.total })}</p>
        )}
      </header>

      {releaseError && (
        <p role="alert" className="text-sm font-medium text-rose-600" data-testid="release-error">
          {releaseError}
        </p>
      )}

      {state.items.length === 0 ? (
        <p className="text-xs text-slate-500" data-testid="suspended-accounts-empty">
          {t('empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {state.items.map((row) => (
            <li
              key={row.accountId}
              className="rounded-2xl border border-slate-200 bg-white p-4"
              data-testid={`suspended-account-${row.accountId}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900">{row.displayName}</span>
                {/* Status is always text as well as colour (DESIGN.md): the badge never
                    carries the meaning on its own. */}
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                  {t('status.suspended')}
                </span>
              </div>

              <p className="mt-1 text-xs text-slate-500">{row.email}</p>

              <dl className="mt-2 flex flex-col gap-1 text-xs">
                <div className="flex flex-wrap gap-1">
                  <dt className="font-medium text-slate-600">{t('reasonLabel')}</dt>
                  <dd className="text-slate-800">{row.reason}</dd>
                </div>
                <div className="flex flex-wrap gap-1">
                  <dt className="font-medium text-slate-600">{t('sinceLabel')}</dt>
                  <dd className="text-slate-800">
                    {new Date(row.suspendedAt).toLocaleString(locale === 'en' ? 'en-GB' : 'vi-VN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-1">
                  <dt className="font-medium text-slate-600">{t('byLabel')}</dt>
                  <dd className="break-all text-slate-800">
                    {/* A suspension without a named Administrator predates ADR-037's
                        actor column; saying so is more honest than a blank. */}
                    {row.suspendedBy ?? t('byUnknown')}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {pendingId === row.accountId ? (
                  <>
                    <span className="text-xs text-slate-700">{t('confirmRelease')}</span>
                    <button
                      type="button"
                      disabled={releasing === row.accountId}
                      onClick={() => void release(row.accountId)}
                      className="rounded-full bg-campus-emerald-deep px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-ink disabled:opacity-60"
                    >
                      {releasing === row.accountId ? t('releasing') : t('releaseConfirm')}
                    </button>
                    <button
                      type="button"
                      disabled={releasing === row.accountId}
                      onClick={() => setPendingId(null)}
                      className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                    >
                      {t('cancel')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingId(row.accountId);
                      setReleaseError(null);
                    }}
                    className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-emerald-600"
                  >
                    {t('release')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
