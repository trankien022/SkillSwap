'use client';

import { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { callApiOk, unwrapEnvelope } from '../../../../lib/api-client';
import { PageIntro } from '../../../../components/ui/PageIntro';
import { StatePanel } from '../../../../components/ui/StatePanel';
import { WorkspaceFooter } from '../../../../components/ui/WorkspaceFooter';
import { Navbar } from '../../../../components/navbar';
import type { WalletBalanceView, MeResponse } from '@skillswap/contracts';

export default function WithdrawalPage() {
  const tUnavailable = useTranslations('Wallet.withdrawal');
  const t = useTranslations('Workspace.wallet');
  const locale = useLocale();
  const [balance, setBalance] = useState<WalletBalanceView | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Both reads are required: the page must not show a spendable balance it
        // could not read, so a failure is surfaced instead of silently leaving
        // the withdrawal limits at their placeholder defaults.
        const [balRes, meRes] = await Promise.all([
          callApiOk('/wallet/balance'),
          callApiOk('/auth/me'),
        ]);
        setBalance(await unwrapEnvelope(balRes));
        setMe(await unwrapEnvelope(meRes));
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : tUnavailable('loadError'));
      }
    };
    loadData();
  }, [tUnavailable]);

  return <div className="flex min-h-dvh flex-col bg-mist text-ink"><Navbar currentTab="wallet" balance={balance} me={me}/><main id="main-content" tabIndex={-1} className="workspace-page workspace-page-narrow flex-1"><PageIntro title={t('withdrawTitle')} description={t('withdrawDescription')} actions={<a href={`/${locale}/wallet`} className="workspace-link">← {t('backWallet')}</a>}/>{loadError && <p role="alert" data-testid="withdrawal-load-error" className="workspace-feedback workspace-feedback-error mb-6">{loadError}</p>}<section className="workspace-panel mb-6"><h2 className="workspace-panel-title">{t('available')}</h2><p className="mt-4 text-3xl font-bold">{balance ? balance.availableCredits.toLocaleString(locale) : '—'} <span className="text-base font-medium">{t('credits')}</span></p><p className="mt-3 text-sm text-ink-soft">{t('rateHint')}</p></section><StatePanel title={tUnavailable('notice')} art="peer-learning" action={<a href={`/${locale}/wallet`} className="workspace-primary">{t('backWallet')}</a>}>{tUnavailable('body')}</StatePanel></main><WorkspaceFooter/></div>;
}
