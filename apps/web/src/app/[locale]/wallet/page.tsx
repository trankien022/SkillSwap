'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { callApi, callApiOk, unwrapEnvelope, dispatchWalletBalanceUpdate } from '../../../lib/api-client';
import { PageIntro } from '../../../components/ui/PageIntro';
import { StatePanel } from '../../../components/ui/StatePanel';
import { WorkspaceFooter } from '../../../components/ui/WorkspaceFooter';
import { Navbar } from '../../../components/navbar';
import type {
  WalletBalanceView,
  WalletHistoryItemView,
  MeResponse,
  TopUpIntentCreated,
  TopUpIntentStatusView,
} from '@skillswap/contracts';

function getCombinedHistory(serverItems: WalletHistoryItemView[]): WalletHistoryItemView[] {
  // The server ledger is the only source of wallet history. An earlier version
  // merged in entries parsed from a `skillswap_user_bookings` localStorage key,
  // inventing a debit (`amountCredits: 90` when the stored value was missing)
  // for each cached booking. That key has no writers left, and a synthesised
  // ledger entry is indistinguishable from a real one to the learner.
  return serverItems;
}

/** Terminal states: polling stops as soon as the intent can no longer change. */
const TERMINAL_TOP_UP_STATUSES = new Set(['settled', 'failed', 'reversed']);
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 120_000;


export default function WalletPage() {
  const locale = useLocale();
  const t = useTranslations('Workspace.wallet');
  const [notice, setNotice] = useState<string | null>(null);
  const [balance, setBalance] = useState<WalletBalanceView | null>(null);
  const [history, setHistory] = useState<WalletHistoryItemView[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);

  const [amount, setAmount] = useState(100);
  const [filter, setFilter] = useState('all');
  const [isPending, setIsPending] = useState(false);
  const [activeIntent, setActiveIntent] = useState<TopUpIntentCreated | null>(null);
  const [intentStatus, setIntentStatus] = useState<TopUpIntentStatusView | null>(null);
  const [pollExpired, setPollExpired] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Refreshes balance + history from the server (never computed locally). */
  const refreshWallet = useCallback(async () => {
    const [balRes, histRes] = await Promise.all([
      callApiOk('/wallet/balance'),
      callApiOk('/wallet/history'),
    ]);

    const newBal = await unwrapEnvelope<WalletBalanceView>(balRes);
    setBalance(newBal);
    dispatchWalletBalanceUpdate(newBal);

    const data = await unwrapEnvelope<{ items: WalletHistoryItemView[] }>(histRes);
    setHistory(getCombinedHistory(data.items || []));
  }, []);

  useEffect(() => {
    setHistory(getCombinedHistory([]));

    const fetchWallet = async () => {
      try {
        // Every read here is required to render the ledger truthfully, so a
        // failure is reported rather than swallowed into an empty page.
        const [balRes, histRes, meRes] = await Promise.all([
          callApiOk('/wallet/balance'),
          callApiOk('/wallet/history'),
          callApiOk('/auth/me'),
        ]);

        // Read the balance straight from the server; it is never cached.
        setBalance(await unwrapEnvelope<WalletBalanceView>(balRes));

        const data = await unwrapEnvelope<{ items: WalletHistoryItemView[] }>(histRes);
        setHistory(getCombinedHistory(data.items || []));

        setMe(await unwrapEnvelope(meRes));
      } catch (e) {
        // An empty ledger and an unread ledger look identical, so the failure
        // is surfaced instead of leaving a blank list that reads as "no
        // transactions".
        setLoadError(e instanceof Error ? e.message : t('loadError'));
      }
    };
    fetchWallet();
  }, []);

  const filteredHistory = history.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'deposit') return item.direction === 'credit';
    if (filter === 'pay') return item.direction === 'debit';
    if (filter === 'escrow') return item.type.toLowerCase().includes('escrow') || item.status === 'reversed';
    return true;
  });

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 0;
    setAmount(val);
  };

  const setQuickAmount = (val: number) => {
    setAmount(val);
  };

  const scrollToDeposit = () => {
    const el = document.getElementById('deposit-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  /**
   * Polls the intent until it settles, the user's time budget runs out, or we
   * stop. The SePay IPN settles the intent server-to-server and pushes nothing
   * to the browser, so polling the server's own record is the only honest way
   * for this screen to learn the outcome.
   */
  const pollIntent = useCallback(
    async (intentId: string) => {
      const deadline = Date.now() + POLL_TIMEOUT_MS;

      const tick = async () => {
        // A new run or an unmount clears the timer, so a late tick is a no-op.
        pollTimer.current = null;
        try {
          const res = await callApiOk(`/wallet/top-ups/${intentId}`);
          const status = await unwrapEnvelope<TopUpIntentStatusView>(res);
          setIntentStatus(status);
          if (TERMINAL_TOP_UP_STATUSES.has(status.status)) {
            await refreshWallet();
            return;
          }
        } catch (e) {
          // The poll only learns the outcome from the server, so a failed read
          // is retried rather than treated as "no change" and silently dropped.
          console.warn('Top-up poll failed', e);
        }

        if (Date.now() >= deadline) {
          setPollExpired(true);
          return;
        }
        pollTimer.current = setTimeout(() => void tick(), POLL_INTERVAL_MS);
      };

      await tick();
    },
    [refreshWallet],
  );

  // Stop polling when the screen goes away; a timer outliving the component
  // would keep hitting the API and warn on a dead component.
  useEffect(() => {
    return () => {
      if (pollTimer.current !== null) {
        clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, []);

  const handleTopUp = async () => {
    if (amount <= 0) {
      setNotice(t('minAmount'));
      return;
    }
    try {
      setIsPending(true);
      setNotice(null);
      setPollExpired(false);
      setIntentStatus(null);

      const res = await callApi('/wallet/top-ups', {
        method: 'POST',
        body: JSON.stringify({
          amountVnd: amount * 1000,
          // FR-008: come back to this client's own page rather than the
          // configured fallback, so the payer lands somewhere that can read
          // the intent back. Absolute, because SePay compares origins.
          returnUrl: new URL(`/${locale}/payment/result`, window.location.origin).toString(),
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setNotice(t('signInError'));
          return;
        }
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        setNotice(err.message || t('topUpError'));
        return;
      }

      const intent = await unwrapEnvelope<TopUpIntentCreated>(res);
      setActiveIntent(intent);

      // ADR-033 / design B: the API already submitted the signed checkout form
      // to SePay and returned the hosted payment URL. Hand the user off and let
      // the IPN do the settling; this handler never fabricates a success and
      // never computes the new balance locally — the poll reads it from the
      // server, which is the only authority on whether a top-up settled.
      window.open(intent.paymentUrl, '_blank', 'noopener,noreferrer');
      void pollIntent(intent.id);
    } catch (e: unknown) {
      console.error(e);
      const errMsg = e instanceof Error ? e.message : t('retry');
      setNotice(errMsg);
    } finally {
      setIsPending(false);
    }
  };

  /** The manual escape hatch when the poll window has lapsed. */
  const handleRefreshBalance = async () => {
    try {
      await refreshWallet();
      if (activeIntent !== null) {
        setPollExpired(false);
        await pollIntent(activeIntent.id);
      }
    } catch (e: unknown) {
      console.error(e);
      setNotice(t('refreshError'));
    }
  };

  const number = (value: number) => value.toLocaleString(locale);
  return (
    <div className="flex min-h-dvh flex-col bg-mist text-ink">
      <Navbar currentTab="wallet" balance={balance} me={me} />
      <main id="main-content" tabIndex={-1} className="workspace-page flex-1">
        <PageIntro title={t('title')} description={t('description')} actions={<><button onClick={scrollToDeposit} className="workspace-primary">{t('topUp')}<span aria-hidden="true">↗</span></button><a href={`/${locale}/wallet/withdrawal`} className="workspace-link">{t('withdraw')}</a></>} />
        {loadError && <p role="alert" data-testid="wallet-load-error" className="workspace-feedback workspace-feedback-error mb-6">{t('loadError')} {loadError}</p>}
        <dl className="workspace-wallet-summary">
          <div><dt>{t('available')}</dt><dd>{balance ? number(balance.availableCredits) : '—'} <span>{t('credits')}</span></dd><p>{balance ? `${number(balance.availableCredits * 1000)} VND` : t('unavailable')}</p></div>
          <div><dt>{t('held')}</dt><dd>{balance ? number(balance.pendingCredits) : '—'} <span>{t('credits')}</span></dd><p>{t('heldHint')}</p></div>
          <div><dt>{t('rate')}</dt><dd className="workspace-wallet-rate">1 <span>{t('credits')}</span> = 1.000 VND</dd><p>{t('rateHint')}</p></div>
        </dl>
        <div id="deposit-section" className="workspace-wallet-grid">
          <section className="workspace-panel workspace-form">
            <h2 className="workspace-panel-title">{t('depositTitle')}</h2>
            <p className="mt-3 text-base leading-relaxed text-ink-soft">{t('depositHint')}</p>
            <label htmlFor="wallet-amount" className="mt-6 block font-semibold">{t('amountLabel')}</label>
            <div className="mt-2 flex items-center gap-3"><input id="wallet-amount" type="number" min={1} step={1} inputMode="numeric" value={amount} onChange={handleAmountChange} className="w-full border px-4 py-3" /><span className="text-sm font-semibold">{t('credits')}</span></div>
            <div className="mt-4 flex flex-wrap gap-2">{[50,100,200,500].map(value=><button key={value} onClick={()=>setQuickAmount(value)} aria-pressed={amount === value} className={amount === value ? 'workspace-secondary ring-2 ring-ink' : 'workspace-secondary'}>{number(value)}</button>)}</div>
            <div className="my-6 flex items-center justify-between rounded-xl bg-mist p-4"><span className="text-ink-soft">{t('total')}</span><strong className="text-xl">{number(amount * 1000)} VND</strong></div>
            {notice && <p role="alert" className="workspace-feedback workspace-feedback-error mb-4">{notice}</p>}
            <button type="button" onClick={handleTopUp} disabled={isPending || amount < 1} className="workspace-primary w-full">{isPending ? t('processing') : t('pay')}</button>
          </section>
          <aside className="workspace-panel space-y-5">
            <h2 className="workspace-panel-title">{t('paymentTitle')}</h2>
            <p className="text-base leading-relaxed text-ink-soft">{t('paymentBody')}</p>
            {activeIntent && <a href={activeIntent.paymentUrl} target="_blank" rel="noopener noreferrer" className="workspace-link">{t('reopen')}<span aria-hidden="true">↗</span></a>}
            {intentStatus && <div role="status" data-testid="topup-status" className={`workspace-feedback ${intentStatus.status === 'settled' ? 'workspace-feedback-success' : 'bg-neutral-tint text-ink'}`}><strong>{t(`status.${intentStatus.status}`)}</strong><p className="mt-2 break-all">{intentStatus.providerRef}</p>{pollExpired && <p className="mt-2">{t('pollExpired')}</p>}</div>}
            <button type="button" onClick={handleRefreshBalance} className="workspace-secondary">{t('refresh')}</button>
            <a href={`/${locale}#trust`} className="workspace-link">{t('rules')}</a>
          </aside>
        </div>
        <section className="mt-10" aria-labelledby="wallet-history-heading">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><h2 id="wallet-history-heading" className="workspace-panel-title">{t('history')}</h2><div className="flex flex-wrap gap-2">{['all','deposit','pay','escrow'].map(value=><button key={value} onClick={()=>setFilter(value)} aria-pressed={filter === value} className={filter === value ? 'workspace-secondary ring-2 ring-ink' : 'workspace-secondary'}>{t(`filter.${value}`)}</button>)}</div></div>
          {filteredHistory.length === 0 ? <StatePanel title={loadError ? t('unavailable') : t('emptyTitle')} art="programming">{loadError ? t('loadError') : t('emptyBody')}</StatePanel> : <div className="workspace-ledger">{filteredHistory.map(item=><article key={item.id} className="workspace-ledger-row"><div><h3 className="font-semibold">{item.direction === 'credit' ? t('creditTransaction') : t('debitTransaction')}</h3><p className="mt-1 break-all text-sm text-ink-soft">{item.reference || item.id}</p><p className="mt-2 text-sm text-ink-soft">{new Date(item.createdAt).toLocaleString(locale)}</p></div><div className="workspace-ledger-amount"><strong className={item.direction === 'credit' ? 'text-success-ink' : 'text-ink'}>{item.direction === 'credit' ? '+' : '−'}{number(item.amountCredits)} {t('credits')}</strong><p className="mt-1 text-sm text-ink-soft">{number(item.amountCredits * 1000)} VND</p><span className="mt-2 inline-flex rounded-full bg-neutral-tint px-3 py-1 text-sm">{t.has(`historyStatus.${item.status}`) ? t(`historyStatus.${item.status}`) : item.status}</span></div></article>)}</div>}
        </section>
      </main><WorkspaceFooter />
    </div>
  );
}
