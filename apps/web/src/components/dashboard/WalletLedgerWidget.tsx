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
      <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <AccountBalanceIcon className="h-5 w-5 text-emerald-700" />
          <h3 className="text-base font-bold text-ink">{t('title')}</h3>
        </div>
        <p className="mt-3 text-sm text-ink-soft leading-relaxed">{t('signInToView')}</p>
        <Link
          href={`/${locale}/auth?tab=login`}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
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
    <article className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <AccountBalanceIcon className="h-5 w-5 text-emerald-700" />
        <h3 className="text-base font-bold text-ink">{t('title')}</h3>
      </div>
      <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-mist p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">{t('available')}</span>
          <span className="text-base font-bold text-ink">
            {wallet.availableCredits} credits
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">{t('held')}</span>
          <span className="text-base font-bold text-ink">
            {wallet.heldCredits} credits
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-emerald-600"
            style={{ width: `${heldPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-ink-soft">
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
          <VerifiedUserIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            <strong className="text-ink">{t('noDirectTitle')}: </strong>
            {t('noDirect')}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <HistoryIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
          <span>
            <strong className="text-ink">{t('refundPolicyTitle')}: </strong>
            {t('refundPolicy')}
          </span>
        </div>
      </div>
      <Link
        href={`/${locale}/wallet`}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 py-2.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
      >
        <AccountBalanceWalletIcon className="h-4 w-4 text-emerald-700" />
        <span>{t('details')}</span>
      </Link>
    </article>
  );
}

/* --- Inline SVG glyphs --- */

function AccountBalanceIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 21h18" />
      <path d="M4 10h16l-2 9H6z" />
      <path d="M9 10V5a3 3 0 0 1 6 0v5" />
    </svg>
  );
}

function VerifiedUserIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function HistoryIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 10 9 10" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function AccountBalanceWalletIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="17" cy="15" r="1.2" fill="currentColor" />
    </svg>
  );
}