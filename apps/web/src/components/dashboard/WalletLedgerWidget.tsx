'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import type { WalletSnapshot } from '../../lib/dashboard/types';
import { getTokens } from '../../lib/api-client';

/**
 * Wallet ledger widget (FR-021 dashboard / FR-038 escrow release).
 *
 * Two visual states:
 *  - no auth (pilot): single card with prompt to sign in and direct login button.
 *  - authed: full breakdown of available / held / total + the
 *    wallet invariant progress bar + two trust lines + a link
 *    to the escrow ledger.
 *
 * No '100%' claim, no 'Smart-Escrow' wording, no invented SLA.
 */
export function WalletLedgerWidget({
  wallet,
  isAuthed,
}: {
  wallet: WalletSnapshot | null;
  isAuthed: boolean;
}) {
  const t = useTranslations('Dashboard.wallet');
  const locale = useLocale();
  const [authed, setAuthed] = useState(isAuthed);

  useEffect(() => {
    if (getTokens() !== null) {
      setAuthed(true);
    }
  }, []);

  if (!authed || !wallet) {
    return (
      <article className="workspace-panel">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-ink">{t('title')}</h3>
        </div>
        <p className="mt-3 text-sm text-ink-soft leading-relaxed">{t('signInToView')}</p>
        <Link
          href={`/${locale}/auth?tab=login`}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-campus-emerald-deep px-4 py-2.5 text-sm font-semibold text-white  transition-colors hover:bg-ink"
        >
          <span>{t('signInCta')}</span>
        </Link>
      </article>
    );
  }

  const vnd = wallet.totalCredits * wallet.vndRate;
  const heldPct = Math.min(
    100,
    Math.round((wallet.heldCredits / Math.max(1, wallet.totalCredits)) * 100),
  );
  return (
    <article className="workspace-panel relative overflow-hidden">
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-base font-bold text-ink">{t('title')}</h3>
      </div>
      <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-mist p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">{t('available')}</span>
          <span className="text-base font-bold text-ink">{wallet.availableCredits} credits</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">{t('held')}</span>
          <span className="text-base font-bold text-ink">{wallet.heldCredits} credits</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-campus-emerald-deep"
            style={{ width: `${heldPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm text-ink-soft">
          <span>{t('total')}</span>
          <span>
            {wallet.totalCredits} credits{' '}
            {t('vndEstimate', {
              vnd: vnd.toLocaleString(locale),
            })}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 text-sm text-ink-soft">
        <div className="flex items-start gap-2">
          <span>
            <strong className="text-ink">{t('noDirectTitle')}: </strong>
            {t('noDirect')}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span>
            <strong className="text-ink">{t('refundPolicyTitle')}: </strong>
            {t('refundPolicy')}
          </span>
        </div>
      </div>
      <Link
        href={`/${locale}/wallet`}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
      >
        <span>{t('details')}</span>
      </Link>
    </article>
  );
}
