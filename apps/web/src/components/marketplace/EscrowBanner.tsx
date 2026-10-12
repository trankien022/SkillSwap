import { getTranslations } from 'next-intl/server';

/**
 * Payment protection assurance banner (FR-006 footer pattern).
 *
 * Copy is faithful to the SRS escrow rules (BR-058/061, ADR-019,
 * AC-022..AC-027). We do not promise '100% refund' — refunds are
 * app-wallet credits only (OQ-003 resolved). We do not say 'Smart-Escrow'
 * because the ledger has no smart-contract surface.
 */
export async function EscrowBanner() {
  const t = await getTranslations('Marketplace.banner');

  return (
    <section className="w-full border-y border-border bg-mist">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 rounded-xl border border-border bg-surface p-6 shadow-sm md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-success-tint bg-success-tint text-success-ink">
              <ShieldIcon className="h-7 w-7" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-ink">
                  {t('title')}
                </h3>
                <span className="rounded-full border border-success-tint bg-success-tint px-2 py-0.5 text-[11px] font-semibold text-success-ink">
                  {t('badge')}
                </span>
              </div>
              <p className="max-w-2xl text-sm text-ink-soft">
                {t('body')}
              </p>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col items-center gap-2 sm:w-auto sm:flex-row">
            <a
              href="#"
              aria-disabled="true"
              tabIndex={-1}
              className="w-full rounded-lg border border-border bg-mist px-4 py-2 text-center text-sm font-semibold text-ink transition-colors hover:bg-neutral-tint sm:w-auto"
            >
              {t('policyLink')}
            </a>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-campus-emerald px-4 py-2 text-sm font-semibold text-surface shadow-sm transition-colors hover:bg-campus-emerald-deep sm:w-auto"
            >
              <SupportIcon className="h-4 w-4" />
              <span>{t('support')}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ShieldIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z" />
    </svg>
  );
}

function SupportIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l1.4-4.7A8.5 8.5 0 1 1 21 11.5z" />
    </svg>
  );
}