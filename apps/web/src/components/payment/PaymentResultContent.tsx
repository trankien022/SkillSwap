'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { callApiOk, dispatchWalletBalanceUpdate, unwrapEnvelope } from '../../lib/api-client';
import type { WalletBalanceView, TopUpIntentStatusView } from '@skillswap/contracts';

/** Terminal states: once the intent can no longer change, polling stops. */
const TERMINAL_TOP_UP_STATUSES = new Set(['settled', 'failed', 'reversed']);
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 120_000;

type Phase = 'loading' | 'ready';

export interface PaymentResultContentProps {
  /** The intent id, when the link carries it (hand-built links, older ones). */
  intentId: string | null;
  /** The invoice number SePay's redirect carries — the usual handle. */
  providerRef: string | null;
}

/** The URL path that reads one intent, whichever handle we hold. */
function intentPath(intentId: string | null, providerRef: string | null): string | null {
  if (providerRef !== null && providerRef !== '') {
    return `/wallet/top-ups/by-provider-ref/${encodeURIComponent(providerRef)}`;
  }
  if (intentId !== null && intentId !== '') {
    return `/wallet/top-ups/${encodeURIComponent(intentId)}`;
  }
  return null;
}

/**
 * FR-008 / ADR-033: the web payer's return page.
 *
 * **It never claims success from the redirect.** SePay sends the payer here for
 * success, error and cancel alike, and settlement happens server-to-server
 * through the IPN. So this screen states the truth it can read — the intent's
 * status and the wallet balance — and keeps polling until the intent is
 * terminal or the time budget runs out. A pending intent stays "waiting for
 * SePay", which is exactly what it is.
 */
export function PaymentResultContent({ intentId, providerRef }: PaymentResultContentProps) {
  const t = useTranslations('PaymentResult');
  const locale = useLocale();
  const path = intentPath(intentId, providerRef);

  const [phase, setPhase] = useState<Phase>('loading');
  const [intent, setIntent] = useState<TopUpIntentStatusView | null>(null);
  const [balance, setBalance] = useState<WalletBalanceView | null>(null);
  const [intentError, setIntentError] = useState(false);
  const [balanceError, setBalanceError] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [busy, setBusy] = useState(false);

  const readAll = useCallback(async () => {
    // Both reads are independent: a failed balance must not hide the intent.
    const [intentResult, balanceResult] = await Promise.allSettled([
      path === null ? Promise.resolve(null) : callApiOk(path),
      callApiOk('/wallet/balance'),
    ]);

    if (intentResult.status === 'fulfilled' && intentResult.value !== null) {
      try {
        setIntent(await unwrapEnvelope<TopUpIntentStatusView>(intentResult.value));
        setIntentError(false);
      } catch {
        setIntentError(true);
      }
    } else if (intentResult.status === 'rejected') {
      setIntentError(true);
    }

    if (balanceResult.status === 'fulfilled') {
      try {
        const next = await unwrapEnvelope<WalletBalanceView>(balanceResult.value);
        setBalance(next);
        dispatchWalletBalanceUpdate(next);
        setBalanceError(false);
      } catch {
        setBalanceError(true);
      }
    } else {
      setBalanceError(true);
    }

    setPhase('ready');
  }, [path]);

  // Initial read, then keep reading while the intent can still change.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    const run = async () => {
      await readAll();
      if (cancelled) return;
      if (path === null) return;

      const tick = async () => {
        timer = null;
        if (cancelled) return;
        try {
          const res = await callApiOk(path);
          const status = await unwrapEnvelope<TopUpIntentStatusView>(res);
          if (cancelled) return;
          setIntent(status);
          setIntentError(false);
          if (TERMINAL_TOP_UP_STATUSES.has(status.status)) {
            await readAll();
            return;
          }
        } catch {
          // The poll only learns the outcome from the server; a failed read is
          // retried rather than treated as "no change".
          if (cancelled) return;
        }

        if (Date.now() >= deadline) {
          setTimedOut(true);
          return;
        }
        timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
      };

      timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
    };

    void run();

    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, [path, readAll]);

  const handleRefresh = async () => {
    setBusy(true);
    setTimedOut(false);
    try {
      await readAll();
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'loading') {
    return (
      <p data-testid="payment-result-loading" className="text-sm text-slate-600">
        {t('refreshCta')}…
      </p>
    );
  }

  // No intent in the URL at all: this is a page someone opened by hand (or an
  // old link). Say so, and point at the wallet, which is the only place the
  // truth can be read without a handle.
  if (path === null) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="workspace-title">{t('title')}</h1>
        <p className="text-sm font-medium text-slate-800" data-testid="payment-result-no-intent">
          {t('noIntent')}
        </p>
        <p className="workspace-description">{t('noIntentHelp')}</p>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/${locale}/wallet`}
            className="rounded-full bg-campus-emerald-deep px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink"
          >
            {t('walletCta')}
          </a>
          <a
            href={`/${locale}/classes`}
            className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            {t('exploreCta')}
          </a>
        </div>
      </div>
    );
  }

  const status = intent?.status ?? 'unknown';
  const isSettled = status === 'settled';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="workspace-title">{t('title')}</h1>
        <p className="workspace-description">{t('notice')}</p>
      </header>

      <section className="workspace-panel">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold  text-slate-500">{t('intentLabel')}</dt>
            <dd
              className="mt-1 break-all text-sm text-slate-900"
              data-testid="payment-result-intent"
            >
              {intent?.providerRef ?? providerRef ?? intentId}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold  text-slate-500">{t('statusLabel')}</dt>
            <dd
              className={`mt-1 text-sm font-semibold ${
                isSettled
                  ? 'text-emerald-700'
                  : status === 'pending'
                    ? 'text-amber-700'
                    : status === 'unknown'
                      ? 'text-slate-700'
                      : 'text-rose-700'
              }`}
              data-testid="payment-result-status"
            >
              {t(`status.${status}` as 'status.pending')}
            </dd>
          </div>
          {intent !== null && (
            <>
              <div>
                <dt className="text-sm font-semibold  text-slate-500">{t('amountLabel')}</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {intent.paidAmountVnd?.toLocaleString('vi-VN') ??
                    intent.amountVnd.toLocaleString('vi-VN')}{' '}
                  VND
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold  text-slate-500">{t('creditsLabel')}</dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {intent.amountCredits.toLocaleString('vi-VN')} Credits
                </dd>
              </div>
            </>
          )}
          <div>
            <dt className="text-sm font-semibold  text-slate-500">{t('balanceLabel')}</dt>
            <dd className="mt-1 text-sm text-slate-900" data-testid="payment-result-balance">
              {balance !== null
                ? `${balance.availableCredits.toLocaleString('vi-VN')} Credits`
                : t('balanceUnavailable')}
            </dd>
          </div>
        </dl>

        {intentError && (
          <p
            className="mt-4 text-sm font-medium text-rose-700"
            data-testid="payment-result-intent-error"
          >
            {t('intentUnavailable')}
          </p>
        )}
        {balanceError && (
          <p className="mt-2 text-sm font-medium text-rose-700">{t('balanceUnavailable')}</p>
        )}
        {timedOut && !TERMINAL_TOP_UP_STATUSES.has(status) && (
          <p className="mt-4 text-sm leading-relaxed text-slate-600">{t('noIntentHelp')}</p>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={busy}
          className="rounded-full bg-campus-emerald-deep px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink disabled:opacity-60"
        >
          {busy ? t('refreshing') : t('refreshCta')}
        </button>
        <a
          href={`/${locale}/wallet`}
          className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
        >
          {t('walletCta')}
        </a>
        <a
          href={`/${locale}/classes`}
          className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
        >
          {t('exploreCta')}
        </a>
      </div>
    </div>
  );
}
